/// <reference types="./cf-worker.d.ts" />

const keyPrefix = "repo:";
const maxWrittenForksCount = 90000;

const charPoint0 = "0".codePointAt(0)!;
const charPoint9 = "9".codePointAt(0)!;

/**
 * Generates a key name of repo:$FORK_COUNT:$REPO_ID with padding
 * to facilitate ordering by fork_count since Cloudflare KV
 * doesn't support secondary indexes.
 *
 * Due to CF KV being incapable of listing keys in reverse we
 * must reverse the key before storing it ourselves to enable
 * fetching the "top N" records.
 */
function generateKey(record: GithubRepoRecord) {
  const forksCount = String(record.forks_count).padStart(6, "0");
  let forksCountReversed = "";
  for (const char of forksCount) {
      // Reverse the digits
      const oldCharCodePoint = char.codePointAt(0)!;
      const newCharCodePoint = charPoint0 + (charPoint9 - oldCharCodePoint);
      forksCountReversed += String.fromCodePoint(newCharCodePoint);
  }
  const recordId = String(record.id).padStart(12, "0");
  return `${keyPrefix}${forksCountReversed}:${recordId}` as const;
}

type KvDbKey = KVNamespaceListKey<unknown, string>;

/**
 * This function is required because 
 */
async function listTopN(prefix: string, count: number, db: KVNamespace): Promise<{ keys: KvDbKey[] }> {
  const keys: KvDbKey[] = [];
  let cursor = "";

  while (keys.length < count) {
    const result = await db.list({
      prefix,
      limit: count,
      ...(cursor && { cursor }),
    });

    for (const key of result.keys) {
      if (key?.name) {
        keys.push(key);

        // We've already collected enough keys
        if (keys.length === count) {
          break;
        }
      }
    }

    if (result.list_complete) {
      // There are no more keys to fetch—we've reached the end
      break;
    } else {
      cursor = result.cursor;
    }
  }

  return { keys };
}

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

type Env = {
  deno_kv_ns: KVNamespace;
  DENO_KV_FRONTEND_SECRET: string;
  DENO_KV_FRONTEND_SECRET_HEADER: string;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const isValidSecret = request.headers.get(env.DENO_KV_FRONTEND_SECRET_HEADER) === env.DENO_KV_FRONTEND_SECRET;
    const isValidPath = new URL(request.url).pathname === "/top-10";
    if (!(isValidSecret && isValidPath)) {
      return new Response("", {
        status: 400,
      });
    }

    const db = env.deno_kv_ns;

    const readStart = performance.now();
    const keyResponse = await listTopN(keyPrefix, 10, db);
    const valuePromises = keyResponse.keys.map((key) => db.get(key.name, "text"));
    const valuesJson = await Promise.all(valuePromises);
    const values: GithubRepoRecord[] = valuesJson.map((json) => JSON.parse(json!));
    const readLatency = performance.now() - readStart;

    const writeStart = performance.now();
    const updatePromises: Promise<void>[] = [];
    for (const record of values) {
      // Double random just to increase the "randomness" a bit more
      const newForksCount = Math.floor(Math.random() * maxWrittenForksCount * Math.random());
      const newRecord: GithubRepoRecord = {
        ...record,
        forks_count: newForksCount,
      };
      updatePromises.push(db.put(generateKey(newRecord), JSON.stringify(newRecord)));
    }
    const deletePromises = keyResponse.keys.map((key) => db.delete(key.name));
    await Promise.all(updatePromises.concat(deletePromises));
    const writeLatency = performance.now() - writeStart;

    const response = {
      latencies: {
        read: readLatency,
        write: writeLatency,
      },
      records: values,
    };

    return new Response(JSON.stringify(response), {
      headers: {
        "content-type": "application/json",
      },
    });
  }
}
