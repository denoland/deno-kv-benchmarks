# Provisioning Deno KV Benchmark
This project is primarily managed through Terraform. The different
scripts rely on the assumption that Terraform was run to provision
and populate the various resources. They also need to use
Terraform's state file in addition to the environment variables
listed below to populate the databases.

## Tools used to test this Terraform code

| Name | Version |
| ---- | ------- |
| [Terraform] | v1.4.6 |
| [Deno] | v1.33.4 |
| [Node.js] | v18.16.0 |
| [Wrangler] | v3.0.0 |
| [jq] | v1.6 |
| bash | v5.1.16 |

## Things to consider
This Terraform project assumes that your Cloudflare account only
has a single account member.

## Prerequisites
### Google Cloud Platform
You **must** enable the following APIs in your Google Cloud Platform
(GCP) project via the API Library before you can provision the GCP
resources:

 - Cloud Functions API
 - Cloud Run API
 - Artifact Registry API
 - Cloud Build API
 - Google Cloud Firestore API

### Upstash
You **must** deploy an [Upstash Redis] database in the
same AWS region as the AWS Lambda function (us-west-2
Oregon was used for the tests) and set the URL for the
env variables listed below.

### Cloudflare
You **must** create a worker function (the default hello world function
will suffice) through the CF Worker dashboard and deploy it before
you can run `terraform apply`. This is because to deploy worker
functions programmatically you must have a subdomain which the
Worker dashboard creates automatically, and there's no good way
to automate that programmatically at this time.

You also **must** manually subscribe to the Workers & Pages paid
plan _after_ adding your payment information.

## Required environment variables
These environment variables are required to be set when
running terraform and the scripts that provision and
populate the lambda/cloud functions.

Some of the variables are prefixed with `TF_VAR_` to ensure that
they're shared with Terraform.

 - `DENO_DEPLOY_TOKEN`
 - `DENO_DEPLOY_FRONTEND_PROJECT` - the frontend Fresh project that displays all the numbers
 - `DENO_DEPLOY_BACKEND_PROJECT` - the backend project that reads & writes to Deno KV
 - `AWS_ACCESS_KEY_ID`
 - `AWS_SECRET_ACCESS_KEY`
 - `AWS_DEFAULT_REGION`
 - `AWS_REGION`
 - `GOOGLE_APPLICATION_CREDENTIALS` - pointing to a [GCP service account key] JSON file
 - `TF_VAR_CLOUDFLARE_API_TOKEN`
 - `TF_VAR_UPSTASH_REDIS_HOST`
 - `TF_VAR_UPSTASH_REDIS_PASSWORD`

<!-- Links -->
[GCP service account key]: https://cloud.google.com/iam/docs/keys-create-delete#creating
[Upstash Redis]: https://upstash.com/redis
[Terraform]: https://developer.hashicorp.com/terraform/downloads
[Deno]: https://deno.land/
[Node.js]: https://nodejs.org/
[Wrangler]: https://developers.cloudflare.com/workers/wrangler/
[jq]: https://stedolan.github.io/jq/
