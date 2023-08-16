# Provisioning Deno KV Benchmark

This project is primarily managed through Terraform. The different scripts rely
on the assumption that Terraform was run to provision and populate the various
resources. They also need to use Terraform's state file in addition to the
environment variables listed below to populate the databases.

Terraform is treated as the source of truth and everything else, scripts,
services, etc, all refer to Terraform's state to provision and configure things.

## Tools required to deploy the Terraform code

You **must** have the following list of tools installed.

| Name        | Version  |
| ----------- | -------- |
| [Terraform] | v1.4.6   |
| [Deno]      | v1.33.4  |
| [Node.js]   | v18.16.0 |
| [Wrangler]  | v3.0.0   |
| [jq]        | v1.6     |
| bash        | v5.1.16  |

## Prerequisites

### Google Cloud Platform

You **must** enable the following APIs in your Google Cloud Platform (GCP)
project via the API Library before you can provision the GCP resources:

- Cloud Functions API
- Cloud Run API
- Artifact Registry API
- Cloud Build API
- Google Cloud Firestore API
- Compute Engine API

### Upstash

You **must** deploy an [Upstash Redis] database in the same AWS region as the
AWS Lambda function (us-west-2 Oregon was used for the tests) and set the URL
for the env variables listed below.

### Cloudflare

You **must** create a worker function (the default hello world function will
suffice) through the CF Worker dashboard and deploy it before you can run
`terraform apply`. This is because to deploy worker functions programmatically
you must have a subdomain which the Worker dashboard creates automatically, and
there's no good way to automate that programmatically at this time.

You also **must** manually subscribe to the Workers & Pages paid plan _after_
adding your payment information.

You can find a log of `wrangler`'s output stored in
`setup/provision/cf-wrangler.log` from the project root after you run
`terraform apply`. The file won't be updated/wrangler won't be run if the source
file (`services/cloudflare-workers-kv/src/index.ts`) hasn't been updated since
the last time `wrangler` was run.

## Required environment variables

These environment variables **must** be set when running terraform and the
scripts that provision and populate the lambda/cloud functions/deno deploy code.

Some of the variables are prefixed with `TF_VAR_` to ensure that they're shared
with Terraform.

- `DENO_DEPLOY_TOKEN`
- `DENO_DEPLOY_FRONTEND_PROJECT` - the frontend Fresh project that displays all
  the numbers
- `DENO_DEPLOY_BACKEND_PROJECT` - the backend project that reads & writes to
  Deno KV
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`
- `AWS_REGION`
- `GOOGLE_APPLICATION_CREDENTIALS` - pointing to a [GCP service account key]
  JSON file
- `TF_VAR_CLOUDFLARE_ACCOUNT_ID`
- `TF_VAR_CLOUDFLARE_API_TOKEN`
- `TF_VAR_UPSTASH_REDIS_HOST`
- `TF_VAR_UPSTASH_REDIS_PASSWORD`

## Deployment

After all of the environment variables listed in
[required environment variables](#required-environment-variables) are available,
and all of the prerequisites are satisfied, you can deploy the infrastructure
with

```bash
terraform apply
```

and typing `yes` at the prompt and pressing enter.

<!-- Links -->

[GCP service account key]: https://cloud.google.com/iam/docs/keys-create-delete#creating
[Upstash Redis]: https://upstash.com/redis
[Terraform]: https://developer.hashicorp.com/terraform/downloads
[Deno]: https://deno.land/
[Node.js]: https://nodejs.org/
[Wrangler]: https://developers.cloudflare.com/workers/wrangler/
[jq]: https://stedolan.github.io/jq/
