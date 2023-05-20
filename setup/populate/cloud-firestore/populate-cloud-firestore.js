// @ts-check
/// <reference path="./populate-cloud-firestore.d.ts" />
import Firestore from "@google-cloud/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const googleCredentialsEnv = "GOOGLE_APPLICATION_CREDENTIALS";

const currentWorkingDir = dirname(fileURLToPath(import.meta.url));
const googleCredentials = process.env[googleCredentialsEnv];
let gcpProjectId = "";
let gcpFirestoreCollection = "";

if (!googleCredentials) {
  console.error(`Missing required env var: ${googleCredentialsEnv}`);
  process.exit(1);
}

try {
  const tfstateFilepath = join(currentWorkingDir, "../../provision/terraform.tfstate");
  const tfstateContents = readFileSync(tfstateFilepath, "utf-8");
  /** @type {TerraformState} */
  const tfstate = JSON.parse(tfstateContents);

  const gcpProjectIdOutput = tfstate.outputs.gcp_project_id;
  const gcpFirestoreCollectionOutput = tfstate.outputs.gcp_firestore_collection;
  gcpProjectId = gcpProjectIdOutput.type === "string" ? gcpProjectIdOutput.value : "";
  gcpFirestoreCollection = gcpFirestoreCollectionOutput.type === "string" ? gcpFirestoreCollectionOutput.value : "";
} catch (_error) {
  // We don't care to handle any specific errors currently
}

if (!gcpProjectId) {
  console.error("error: failed to get GCP Project ID from the Terraform .tfstate. Did you run Terraform?");
  process.exit(1);
}

const datasetFilepath = readFileSync(join(currentWorkingDir, "../github-repo-dataset.json"), "utf-8");
/** @type {GithubRepoRecord[]} */
const dataset = JSON.parse(datasetFilepath);
const client = new Firestore.Firestore({
  projectId: gcpProjectId,
  keyFilename: googleCredentials,
});

const collection = client.collection(gcpFirestoreCollection);

for (const item of dataset) {
  await collection
    .doc(String(item.id))
    .set(item);
}

const reportedCount = await collection.count().get();

console.log(`Inserted count: ${dataset.length}`);
console.log(`Reported count: ${reportedCount.data().count}`);
