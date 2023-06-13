import RedisDefault from "npm:ioredis@5.3.2";
const Redis = RedisDefault.default;

// Check for the required env
const requiredEnv = [
  "TF_VAR_UPSTASH_REDIS_HOST",
  "TF_VAR_UPSTASH_REDIS_PASSWORD",
].filter((env) => !Deno.env.get(env));

if (requiredEnv.length) {
  console.error(`Missing required env vars: ${requiredEnv.join(", ")}`);
  Deno.exit(1);
}

const {
  TF_VAR_UPSTASH_REDIS_HOST: UPSTASH_REDIS_HOST,
  TF_VAR_UPSTASH_REDIS_PASSWORD: UPSTASH_REDIS_PASSWORD,
} = Deno.env.toObject();

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const dataset: GithubRepoRecord[] = JSON.parse(
  Deno.readTextFileSync("../github-repo-dataset.json"),
);
const client = new Redis(
  `redis://default:${UPSTASH_REDIS_PASSWORD}@${UPSTASH_REDIS_HOST}`,
);
const sortedSetKey = "gh_forks_count";

// There's no record with a forks_count over this number
// in the dataset
const maxForksCount = 100000;

let inserted = 0;
await client.flushdb();
for (const item of dataset) {
  client
    .zadd(sortedSetKey, item.forks_count, JSON.stringify(item))
    .then(async (res) => {
      console.log(`${res}: inserted: ${item.full_name}`);

      inserted++;
      if (inserted === dataset.length) {
        const reportedCount = await client.zcount(
          sortedSetKey,
          0,
          maxForksCount,
        );
        console.log(`Inserted count: ${inserted}`);
        console.log(`Reported count: ${reportedCount}`);
        client.disconnect();
      }
    });
}
