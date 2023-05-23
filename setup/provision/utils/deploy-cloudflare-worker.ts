// This is invoked via Terraform's `external` provider
// to facilitate a way to manage the CF worker as part
// of the Terraform resource lifecycle.
import { readAll } from "https://deno.land/std@0.187.0/streams/read_all.ts";
import { fromFileUrl, join, dirname } from "https://deno.land/std@0.187.0/path/mod.ts";
import { encode } from "https://deno.land/std@0.187.0/encoding/hex.ts";

const currentWorkingDirPath = dirname(fromFileUrl(import.meta.url));
const denoEnv = Deno.env.toObject();

type CfDeployentState = {
  deployed_sha256?: string;
  worker_url?: string;
  account_id?: string;
};

const cfWorkerWranglerConfigFilePath = join(currentWorkingDirPath, "../cf-wrangler.toml");
const cfWorkerDeploymentStateFilePath = join(currentWorkingDirPath, "../cf-worker.state.json");
const cfWorkerDeploymentStateJson = await Deno
  .readTextFile(cfWorkerDeploymentStateFilePath)
  .catch(() => "{}");
const cfWorkerDeploymentState: CfDeployentState = JSON.parse(cfWorkerDeploymentStateJson);
const cfWranglerOutputFilePath = join(currentWorkingDirPath, "../cf-wrangler.log");

type RunCommandArgs = {
  environment?: Record<string, string>;
}

async function runCommand(
  args: string[],
  {
    environment = denoEnv,
  }: RunCommandArgs = {},
) {
  const command = new Deno.Command(args[0], {
    args: args.slice(1),
    env: environment,
    stdout: "piped",
    stderr: "piped",
  });
  return await command.output();
}

function parseJson(json: string, defaultValue: unknown = {}): unknown {
  try {
    return JSON.parse(json);
  } catch (_error) {
    return defaultValue;
  }
}

async function main() {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const inputJson = decoder.decode(await readAll(Deno.stdin));
  const parsedInput = parseJson(inputJson, null);

  if (!parsedInput) {
    console.log(JSON.stringify({
      error: "invalid input. This must be invoked by `terraform apply`",
    }, null, 2));
    Deno.exit(1);
  }

  const {
    cf_account_id,
    cf_worker_name,
    cf_worker_script_file_path,
    cf_worker_kv_namespace_name,
    cf_worker_kv_namespace_id,
  } = parsedInput as Record<string, string>;

  const sourceCode = await Deno.readTextFile(cf_worker_script_file_path);
  const sourceCodeDigest = await crypto.subtle.digest("SHA-256", encoder.encode(sourceCode));
  const sourceCodeDigestHex = decoder.decode(encode(new Uint8Array(sourceCodeDigest)));

  const tomlKvBindingJson = JSON.stringify(cf_worker_kv_namespace_name);
  const tomlKvIdJson = JSON.stringify(cf_worker_kv_namespace_id);
  const tomlConfig = `
    # Top-level configuration
    name = ${JSON.stringify(cf_worker_name)}
    main = ${JSON.stringify(cf_worker_script_file_path)}
    compatibility_date = "2023-03-14"
    workers_dev = true

    kv_namespaces = [
      { binding = ${tomlKvBindingJson}, id = ${tomlKvIdJson} }
    ]
  `;
  await Deno.writeTextFile(cfWorkerWranglerConfigFilePath, tomlConfig);

  let workerUrl = cfWorkerDeploymentState.worker_url;

  if (!workerUrl || sourceCodeDigestHex !== cfWorkerDeploymentState.deployed_sha256) {
    const newState: CfDeployentState = {
      deployed_sha256: sourceCodeDigestHex,
      worker_url: workerUrl,
      account_id: cf_account_id,
    };

    const wranglerOutput = await runCommand([
      "wrangler", "deploy", "-c", cfWorkerWranglerConfigFilePath, cf_worker_script_file_path
    ], {
      environment: {
        ...denoEnv,
        CLOUDFLARE_ACCOUNT_ID: cf_account_id,
        CLOUDFLARE_API_TOKEN: denoEnv.TF_VAR_CLOUDFLARE_API_TOKEN,
      },
    });

    const wranglerStdout = decoder.decode(wranglerOutput.stdout);
    const wranglerStderr = decoder.decode(wranglerOutput.stderr);
    const logOutput = `[${
      new Date().toJSON()
    }] Wrangler Deployment\nExit code: ${
      wranglerOutput.code
    }\nSHA256: ${
      sourceCodeDigestHex
    }\nAccountId: ${
      cf_account_id
    }\nstdout:\n${
      wranglerStdout
    }\nstderr:\n${
      wranglerStderr
    }\n\n`;

    const printedWranglerUrl = wranglerStdout.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
    if (printedWranglerUrl) {
      newState.worker_url = printedWranglerUrl;
      workerUrl = printedWranglerUrl;
    }

    await Deno.writeTextFile(cfWranglerOutputFilePath, logOutput, { append: true });
    await Deno.writeTextFile(cfWorkerDeploymentStateFilePath, JSON.stringify(newState, null, 2));
  }

  const terraformOutput = {
    script_sha256_hash: sourceCodeDigestHex,
    worker_url: workerUrl || undefined,
  };

  // Return output to Terraform
  console.log(JSON.stringify(terraformOutput, null, 2));
}

await main();