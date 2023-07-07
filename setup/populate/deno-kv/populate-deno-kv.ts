import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.187.0/path/mod.ts";

const denoDeployProjectEnv = "DENO_DEPLOY_BACKEND_PROJECT";
const batchMacroInsertSize = 500;
const batchInsertSize = 10; // Hard limit imposed by Deno KV atomic mutations

const currentWorkingDir = dirname(fromFileUrl(import.meta.url));
const denoDeployProject = Deno.env.get(denoDeployProjectEnv);
const svcBaseUrl = `https://${denoDeployProject}.deno.dev`;
// const svcBaseUrl = `http://localhost:8080`;
const svcPopulateEndpoint = "/records";
const svcCountEndpoint = "/count";
const svcPopulateUrl = `${svcBaseUrl}${svcPopulateEndpoint}`;
const svcCountUrl = `${svcBaseUrl}${svcCountEndpoint}`;
let backendServiceSecret = "";
let backendServiceSecretHeader = "";

if (!denoDeployProject) {
  console.error(`Missing required env var: ${denoDeployProjectEnv}`);
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
  const tfstateFilepath = join(
    currentWorkingDir,
    "../../provision/terraform.tfstate",
  );
  const tfstateContents = Deno.readTextFileSync(tfstateFilepath);
  const tfstate: TerraformState = JSON.parse(tfstateContents);

  const backendServiceSecretOutput = tfstate.outputs.backend_service_secret;
  const backendServiceSecretHeaderOutput = tfstate.outputs.backend_service_secret_header;

  if (backendServiceSecretOutput.type === "string" && backendServiceSecretHeaderOutput.type === "string") {
    backendServiceSecret = backendServiceSecretOutput.value;
    backendServiceSecretHeader = backendServiceSecretHeaderOutput.value;
  }
} catch (_error) {
  // We don't care to handle any specific errors currently
}

if (!(backendServiceSecret && backendServiceSecretHeader)) {
  console.error(
    "error: failed to get backend secret & header from the Terraform .tfstate. Did you run Terraform?",
  );
  Deno.exit(1);
}

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const datasetFilepath = Deno.readTextFileSync(
  join(currentWorkingDir, "../github-repo-dataset.json"),
);
const dataset: GithubRepoRecord[] = JSON.parse(datasetFilepath);

type CountEndpointResponse = {
  count: number;
};

async function countRecords() {
  const response = await fetch(svcCountUrl, {
    headers: {
      [backendServiceSecretHeader]: backendServiceSecret,
    },
  });
  const { count } = (await response.json()) as CountEndpointResponse;
  return count;
}

async function bulkWrite(records: GithubRepoRecord[][]) {
  const response = await fetch(svcPopulateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [backendServiceSecretHeader]: backendServiceSecret,
    },
    body: JSON.stringify(records),
  });

  if (response.status !== 200) {
    throw new Error(`failed to write records:\nstatus: ${response.status}\nmessage: ${await response.text()}`);
  }

  return await response.json();
}

// Insert in `batchInsertSize` increments
for (let i = 0; i < dataset.length; i += batchMacroInsertSize) {
  const macroBatch = dataset.slice(i, i + batchMacroInsertSize);
  const batches = new Array(Math.round(macroBatch.length / batchInsertSize))
    .fill(0)
    .map((_, index) => {
      const start = index * batchInsertSize;
      return macroBatch.slice(start, start + batchInsertSize);
    });
  await bulkWrite(batches);
}

const reportedCount = await countRecords();

console.log(`Inserted count: ${dataset.length}`);
console.log(`Reported count: ${reportedCount}`);
