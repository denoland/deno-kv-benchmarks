import { Firestore } from "@google-cloud/firestore";
import functions from "@google-cloud/functions-framework";

const {
  BACKEND_FIRESTORE_COLLECTION,
  DENO_KV_FRONTEND_SECRET,
  DENO_KV_FRONTEND_SECRET_HEADER,
} = process.env as Record<string, string>;

const maxWrittenForksCount = 90000;
const forksField = "forks_count";

const db = new Firestore();
const collection = db.collection(BACKEND_FIRESTORE_COLLECTION);

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

functions.http("denoCloudFn", async (req, res) => {
  const isValidSecret =
    req.headers[DENO_KV_FRONTEND_SECRET_HEADER] === DENO_KV_FRONTEND_SECRET;
  const isValidPath =
    new URL(req.url, "https://cloud.fn").pathname === "/top-10";
  if (!(isValidPath && isValidSecret)) {
    return res.status(400).end("");
  }

  // Initial warmup read
  await collection
    .orderBy(forksField, "desc")
    .limit(10)
    .get();

  const readStart = performance.now();
  const documentQuery = await collection
    .orderBy(forksField, "desc")
    .limit(10)
    .get();
  const records = documentQuery.docs.map((docSnapshot) =>
    docSnapshot.data()
  ) as unknown[] as GithubRepoRecord[];
  const readLatency = performance.now() - readStart;

  const writeStart = performance.now();
  const bulkWriter = db.bulkWriter();
  for (const record of records) {
    const newForksCount = Math.floor(
      Math.random() * maxWrittenForksCount * Math.random(),
    );
    const newRecord: GithubRepoRecord = {
      ...record,
      forks_count: newForksCount,
    };
    bulkWriter.update(collection.doc(String(record.id)), newRecord);
  }
  await bulkWriter.close();
  const writeLatency = performance.now() - writeStart;

  res.contentType("application/json");
  res.end(JSON.stringify({
    latencies: {
      read: readLatency,
      write: writeLatency,
    },
    records,
  }));
});
