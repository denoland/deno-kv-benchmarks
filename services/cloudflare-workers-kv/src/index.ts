/// <reference types="./cf-worker.d.ts" />

const keyPrefix = "repo:";
const maxWrittenForksCount = 90000;
const newValueRetrievalDelayMs = 60_000; // 1 min

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

type KvDbKeyMetadata = { createdAt: string; };
type KvDbKey = KVNamespaceListKey<KvDbKeyMetadata, string>;

/**
 * This function is required because `db.list()` will return deleted keys
 * as null, so we have to skip them and issue another `.list()` command
 * in order to reach the requested key count.
 */
async function listTopN(prefix: string, count: number, db: KVNamespace): Promise<{ keys: KvDbKey[] }> {
  const keys: KvDbKey[] = [];
  let cursor = "";

  while (keys.length < count) {
    const result = await db.list<KvDbKeyMetadata>({
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

function delay(durationInMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

type Env = {
  [key: string]: unknown;
  KV_NAMESPACE_NAME: string;
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
    const pathname = new URL(request.url).pathname;
    const isValidPath = ["/top-10", "/top-10/quit"].includes(pathname);
    if (!(isValidSecret && isValidPath)) {
      return new Response("", {
        status: 400,
      });
    }

    const db = env[env.KV_NAMESPACE_NAME] as KVNamespace;

    // TODO: maybe change the performance readings to only include the time
    // spent actually querying CF KV
    const readStart = performance.now();
    const keyResponse = await listTopN(keyPrefix, 10, db);
    const valuePromises = keyResponse.keys.map(async (key) => {
      const now = new Date().getTime();
      const delayedReadTimestamp = new Date(key.metadata?.createdAt!).getTime() + newValueRetrievalDelayMs;
      let value: string | null = null;

      // You can't request newly created keys on CF KV too quickly
      if (delayedReadTimestamp > now) {
        // Wait however much time is left until the new value read is up
        await delay(delayedReadTimestamp - now);
      }

      // We have to loop a `get` because even though the key exists KV
      // can take a while to return a non-null value
      while (!(value = await db.get(key.name, "text"))) {
        // We need to wait a while since if KV returns null and we request too
        // quickly afterwards then CF will kill our worker due to too many KV
        // requests. If the first request returns null then we'll wait a bit
        // longer until we request again since CF KV takes a while to resolve
        // the new data.
        await delay(newValueRetrievalDelayMs / 2);
      }
      return value;
    });
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
      updatePromises.push(db.put(generateKey(newRecord), JSON.stringify(newRecord), {
        metadata: {
          createdAt: new Date().toJSON(),
        },
      }));
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
