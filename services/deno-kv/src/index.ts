import { Application, Router } from "https://deno.land/x/oak@v12.5.0/mod.ts";

const db = await Deno.openKv();

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const router = new Router();

router.post("/records", async ({ request, response }) => {
  const body = request.body();
  if (body.type === "json") {
    const batches: GithubRepoRecord[][] = await body.value;
    for (const records of batches) {
      const atomic = db.atomic();
      const transaction = records.reduce((atomic, record) => {
        // We will only query by fork count so we don't bother
        // with any secondary indexes here
        return atomic.set(["repos_by_fork_count", record.forks_count, record.id], record);
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

router.get("/count", async ({ response }) => {
  let count = 0;
  for await (const entry of db.list({ prefix: ["repos_by_fork_count"] })) {
    count++;
  }
  response.body = {
    count,
  };
});

router.get("/top-10", async ({ response }) => {
  const records: GithubRepoRecord[] = [];
  for await (const entry of db.list({ prefix: ["repos_by_fork_count"] }, { limit: 10, reverse: true })) {
    records.push(entry.value as GithubRepoRecord);
  }
  response.body = records;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8080 });