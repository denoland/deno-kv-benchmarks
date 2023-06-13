import { Application, Router } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { config } from "./config.ts";

const db = await Deno.openKv();
const keyPrefix = "repos_by_fork_count";
const maxWrittenForksCount = 90000;
const {
  DENO_KV_FRONTEND_SECRET,
  DENO_KV_FRONTEND_SECRET_HEADER,
} = config;

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const router = new Router();

// FIXME: This should probably still add the routes maybe? Not sure
if (DENO_KV_FRONTEND_SECRET && DENO_KV_FRONTEND_SECRET_HEADER) {
  router.post("/records", async ({ request, response }) => {
    if (
      request.headers.get(DENO_KV_FRONTEND_SECRET_HEADER) !==
        DENO_KV_FRONTEND_SECRET
    ) {
      response.status = 400;
      return;
    }

    const body = request.body();
    if (body.type === "json") {
      const batches: GithubRepoRecord[][] = await body.value;
      for (const records of batches) {
        const atomic = db.atomic();
        const transaction = records.reduce((atomic, record) => {
          // We will only query by fork count so we don't bother
          // with any secondary indexes here
          return atomic.set([keyPrefix, record.forks_count, record.id], record);
        }, atomic);
        await transaction.commit();
      }
      response.body = {
        success: true,
      };
    } else {
      response.status = 401;
      response.body = {
        error: "bad request",
      };
    }
  });

  router.get("/count", async ({ request, response }) => {
    if (
      request.headers.get(DENO_KV_FRONTEND_SECRET_HEADER) !==
        DENO_KV_FRONTEND_SECRET
    ) {
      response.status = 400;
      return;
    }

    let count = 0;
    for await (const _ of db.list({ prefix: [keyPrefix] })) {
      count++;
    }
    response.body = {
      count,
    };
  });

  router.get("/top-10", async ({ request, response }) => {
    if (
      request.headers.get(DENO_KV_FRONTEND_SECRET_HEADER) !==
        DENO_KV_FRONTEND_SECRET
    ) {
      response.status = 400;
      return;
    }

    const readStart = performance.now();
    const records: GithubRepoRecord[] = [];
    for await (
      const entry of db.list({ prefix: [keyPrefix] }, {
        limit: 10,
        reverse: true,
      })
    ) {
      records.push(entry.value as GithubRepoRecord);
    }
    const readLatency = performance.now() - readStart;

    const writeStart = performance.now();
    const updatedRecords: GithubRepoRecord[] = [];
    const deleteAtomic = db.atomic();
    for (const record of records) {
      // Double random just to increase the "randomness" a bit more
      const newForksCount = Math.floor(
        Math.random() * maxWrittenForksCount * Math.random(),
      );
      updatedRecords.push({
        ...record,
        forks_count: newForksCount,
      });
      deleteAtomic.delete([keyPrefix, record.forks_count, record.id]);
    }

    const insertAtomic = db.atomic();
    for (const updatedRecord of updatedRecords) {
      insertAtomic.set(
        [keyPrefix, updatedRecord.forks_count, updatedRecord.id],
        updatedRecord,
      );
    }
    await Promise.all([
      deleteAtomic.commit(),
      insertAtomic.commit(),
    ]);
    const writeLatency = performance.now() - writeStart;

    response.body = {
      latencies: {
        read: readLatency,
        write: writeLatency,
      },
      records,
    };
  });
}

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8080 });
