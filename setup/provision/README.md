# Provisioning Deno KV Benchmark
## Required environment variables
These environment variables are required to be set when
running the scripts that provision the lambda/cloud functions.

Some of the variables are prefixed with `TF_VAR_` to ensure that
they're shared with Terraform.

 - `AWS_ACCESS_KEY_ID`
 - `AWS_SECRET_ACCESS_KEY`
 - `AWS_DEFAULT_REGION`
 - `AWS_REGION`
 - `TF_VAR_UPSTASH_REDIS_HOST`
 - `TF_VAR_UPSTASH_REDIS_PASSWORD`

