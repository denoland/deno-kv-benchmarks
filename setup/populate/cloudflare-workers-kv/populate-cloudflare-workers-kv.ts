// This script bulk-writes records with the HTTP API in an effort
// to avoid using the wrangler CLI tool—which is the only other
// option for bulk inserts.
import { fromFileUrl, join, dirname } from "https://deno.land/std@0.187.0/path/mod.ts";

const cloudflareCredentialsEnv = "TF_VAR_CLOUDFLARE_API_TOKEN";
const batchInsertSize = 500;
const keyPrefix = "repo:";

const currentWorkingDir = dirname(fromFileUrl(import.meta.url));
const cfApiToken = Deno.env.get(cloudflareCredentialsEnv);
let cfAccountId = "";
let cfKvNamespaceId = "";

if (!cfApiToken) {
  console.error(`Missing required env var: ${cloudflareCredentialsEnv}`);
  Deno.exit(1);
}

type TerraformState = {
  outputs: {
    [outputName: string]:
      | { value: string; type: "string" }
      | { value: number; type: "number" }
      | { value: boolean; type: "bool" }
      | { value: Record<string, unknown>; type: "object" };
  };
};

try {
  const tfstateFilepath = join(currentWorkingDir, "../../provision/terraform.tfstate");
  const tfstateContents = Deno.readTextFileSync(tfstateFilepath);
  const tfstate: TerraformState = JSON.parse(tfstateContents);

  const cfAccountIdOutput = tfstate.outputs.cf_account_id;
  const cfKvNamespaceIdOutput = tfstate.outputs.cf_kv_namespace_id;
  cfAccountId = cfAccountIdOutput.type === "string" ? cfAccountIdOutput.value : "";
  cfKvNamespaceId = cfKvNamespaceIdOutput.type === "string" ? cfKvNamespaceIdOutput.value : "";
} catch (_error) {
  // We don't care to handle any specific errors currently
}

if (!cfAccountId) {
  console.error("error: failed to get the Cloudflare Account ID from the Terraform .tfstate. Did you run Terraform?");
  Deno.exit(1);
}

if (!cfKvNamespaceId) {
  console.error("error: failed to get the Cloudflare KV Namespace ID from the Terraform .tfstate. Did you run Terraform?");
  Deno.exit(1);
}

/**
 * Generates a key name of repo:$FORK_COUNT:$REPO_ID with padding
 * to facilitate ordering by fork_count since Cloudflare KV
 * doesn't support secondary indexes.
 */
function generateKey(record: GithubRepoRecord) {
  const forksCount = String(record.forks_count).padStart(6, "0");
  const recordId = String(record.id).padStart(12, "0");
  return `${keyPrefix}${forksCount}:${recordId}` as const;
}

async function countKeys(
  prefix: string,
  namespace: string,
  accountId: string,
  token: string,
) {
  let count = 0;
  let cursor = "start";

  while (cursor) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${
      accountId
    }/storage/kv/namespaces/${
      namespace
    }/keys?limit=1000&prefix=${
      encodeURIComponent(prefix)
    }${
      cursor === "start"
        ? ""
        : `&cursor=${encodeURIComponent(cursor)}`
    }`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
    const parsedResponse: {
      errors: { code: number; message: string; };
      messages: { code: number; message: string; };
      result: {
        expiration: number;
        metadata: Record<string, string>;
        name: string;
      }[];
      success: boolean;
      result_info: { count: number; cursor: string; };
    } = await response.json();

    cursor = parsedResponse.result_info.cursor;
    count += parsedResponse.result.length;
  }

  return count;
}

async function bulkWrite(
  records: GithubRepoRecord[],
  namespace: string,
  accountId: string,
  token: string,
) {
  const writeRecords = records.map((record) => {
    const kvRecord = {
      key: generateKey(record),
      value: JSON.stringify(record),
    };
    return kvRecord;
  });

  const url = `https://api.cloudflare.com/client/v4/accounts/${
    accountId
  }/storage/kv/namespaces/${
    namespace
  }/bulk`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(writeRecords),
  });
  return await response.text();
}

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const datasetFilepath = Deno.readTextFileSync(join(currentWorkingDir, "../github-repo-dataset.json"));
const dataset: GithubRepoRecord[] = JSON.parse(datasetFilepath);

// Insert in `batchInsertSize` increments
for (let i = 0; i < dataset.length; i += batchInsertSize) {
  await bulkWrite(
    dataset.slice(i, i + batchInsertSize),
    cfKvNamespaceId,
    cfAccountId,
    cfApiToken,
  );
}

// For some reason the `reportedCount` is inaccurate/lower than
// expected here... Maybe it's due to some weird caching on
// Cloudflare KV's side?
const reportedCount = await countKeys(
  keyPrefix,
  cfKvNamespaceId,
  cfAccountId,
  cfApiToken,
);

console.log(`Inserted count: ${dataset.length}`);
console.log(`Reported count: ${reportedCount}`);
