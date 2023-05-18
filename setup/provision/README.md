# Provisioning Deno KV Benchmark
## Prerequisites
You must enable the following APIs in your Google Cloud Platform
(GCP) project via the API Library before you can provision the GCP
resources:

 - Cloud Functions API
 - Cloud Run API
 - Artifact Registry API
 - Cloud Build API

You must also deploy an [Upstash Redis] database in the
same AWS region as the AWS Lambda function (us-west-2
Oregon was used for the tests) and set the URL for the
env variables listed below.

## Required environment variables
These environment variables are required to be set when
running the scripts that provision the lambda/cloud functions.

Some of the variables are prefixed with `TF_VAR_` to ensure that
they're shared with Terraform.

 - `AWS_ACCESS_KEY_ID`
 - `AWS_SECRET_ACCESS_KEY`
 - `AWS_DEFAULT_REGION`
 - `AWS_REGION`
 - `GOOGLE_APPLICATION_CREDENTIALS` - pointing to a [GCP service account key] JSON file
 - `TF_VAR_UPSTASH_REDIS_HOST`
 - `TF_VAR_UPSTASH_REDIS_PASSWORD`

<!-- Links -->
[GCP service account key]: https://cloud.google.com/iam/docs/keys-create-delete#creating
[Upstash Redis]: https://upstash.com/redis
