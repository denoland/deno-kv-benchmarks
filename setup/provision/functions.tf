# AWS Lambda Functions
module "functions" {
  source = "./aws-lambda-fns"

  region     = local.region
  account_id = local.account_id

  # The .zip artifacts are created by the ./utils/bundle.sh script
  # It should be run every time code is updated in ../../services/
  fns = {
    "upstash-redis" = {
      artifact_zip = "artifacts-upstash-redis.zip"
      pathname     = "upstash-redis"
      variables    = {
        UPSTASH_REDIS_HOST             = var.UPSTASH_REDIS_HOST
        UPSTASH_REDIS_PASSWORD         = var.UPSTASH_REDIS_PASSWORD
        DENO_KV_FRONTEND_SECRET        = local.backend_service_secret
        DENO_KV_FRONTEND_SECRET_HEADER = local.backend_service_secret_header
      }
    }

    "dynamodb-global-tables" = {
      artifact_zip = "artifacts-dynamodb-global-tables.zip"
      pathname     = "dynamodb-global-tables"
      variables    = {
        DYNAMODB_TABLE_NAME            = local.dynamodb_table_name
        DYNAMODB_TABLE_GSI_INDEX       = local.dynamodb_table_gsi_index
        DENO_KV_FRONTEND_SECRET        = local.backend_service_secret
        DENO_KV_FRONTEND_SECRET_HEADER = local.backend_service_secret_header
      }
    }
  }
}

output "lambda_invoke_url" {
  value = module.functions.lambda_invoke_url
}

# GCP Cloud Functions
module "gcp_functions" {
  source = "./gcp-cloud-fns"

  name                  = "deno-cloud-fn"
  artifact_zip          = "artifacts-cloud-firestore.zip"
  location              = local.gcp_region
  entry_point           = "denoCloudFn"
  firestore_collection  = local.gcp_firestore_collection
  service_secret        = local.backend_service_secret
  service_secret_header = local.backend_service_secret_header
}

output "function_invoke_url" {
  value = module.gcp_functions.function_invoke_url
}

output "google_storage_bucket_id" {
  value = module.gcp_functions.google_storage_bucket_id
}

# CF Worker Functions
module "cf_worker_functions" {
  source = "./cf-worker-fns"

  name                  = "deno-worker-fn"
  account_id            = local.cf_account_id
  script_path           = abspath("../../services/cloudflare-workers-kv/build/index.js")
  kv_namespace_binding  = local.cf_kv_namespace
  kv_namespace_id       = cloudflare_workers_kv_namespace.namespace.id
  wrangler_deno_script  = "./utils/deploy-cloudflare-worker.ts"
  service_secret        = local.backend_service_secret
  service_secret_header = local.backend_service_secret_header
}

output "cf_wrangler_output" {
  value = module.cf_worker_functions.worker_deployment_state
}
