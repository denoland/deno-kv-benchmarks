import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import Redis from "ioredis";

const {
  UPSTASH_REDIS_HOST,
  UPSTASH_REDIS_PASSWORD,
  DENO_KV_FRONTEND_SECRET,
  DENO_KV_FRONTEND_SECRET_HEADER,
} = process.env as Record<string, string>;

const sortedSetKey = "gh_forks_count";
const maxWrittenForksCount = 90000;

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const client = new Redis(`redis://default:${UPSTASH_REDIS_PASSWORD}@${UPSTASH_REDIS_HOST}`);

export async function handler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const { headers } = event;
  const isValidSecret = headers[DENO_KV_FRONTEND_SECRET_HEADER] === DENO_KV_FRONTEND_SECRET;
  if (!isValidSecret) {
    return {
      statusCode: 400,
      body: "",
    };
  }

  const readStart = performance.now();
  const recordsJson = await client.zrevrange(sortedSetKey, 0, 9);
  const records: GithubRepoRecord[] = recordsJson.map((recordJson) => JSON.parse(recordJson));
  const readLatency = performance.now() - readStart;

  const writeStart = performance.now();
  const updatedRecords: (string | number)[] = [];
  for (const record of records) {
    const newForksCount = Math.floor(Math.random() * maxWrittenForksCount * Math.random());
    updatedRecords.push(newForksCount, JSON.stringify({
      ...record,
      forks_count: newForksCount,
    }));
  }
  await Promise.all([
    client.zrem(sortedSetKey, ...recordsJson),    // Remove older records
    client.zadd(sortedSetKey, ...updatedRecords), // Insert new updated records
  ]);
  const writeLatency = performance.now() - writeStart;

  return {
    statusCode: 200,
    body: JSON.stringify({
      latencies: {
        read: readLatency,
        write: writeLatency,
      },
      records,
    }),
    headers: {
      "content-type": "application/json",
    },
  };
}