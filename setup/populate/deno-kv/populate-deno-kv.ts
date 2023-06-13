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

if (!denoDeployProject) {
  console.error(`Missing required env var: ${denoDeployProjectEnv}`);
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
  const response = await fetch(svcCountUrl);
  const { count } = (await response.json()) as CountEndpointResponse;
  return count;
}

async function bulkWrite(records: GithubRepoRecord[][]) {
  const response = await fetch(svcPopulateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(records),
  });
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
