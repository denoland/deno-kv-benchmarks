module "functions" {
  source = "./aws-lambda-fns"

  region = local.region
  account_id = local.account_id

  # The .zip artifacts are created by the ./bundle.sh script
  # It should be run every time code is updated in ../../services/
  fns = {
    "upstash-redis" = {
      artifact_zip = "artifacts-upstash-redis.zip"
      pathname = "upstash-redis"
      variables = {
        UPSTASH_REDIS_HOST = var.UPSTASH_REDIS_HOST
        UPSTASH_REDIS_PASSWORD = var.UPSTASH_REDIS_PASSWORD
      }
    }

    "dynamodb-global-tables" = {
      artifact_zip = "artifacts-dynamodb-global-tables.zip"
      pathname = "dynamodb-global-tables"
      variables = {
        DYNAMODB_TABLE_NAME = local.dynamodb_table_name
        DYNAMODB_TABLE_GSI_INDEX = local.dynamodb_table_gsi_index
      }
    }
  }
}

output "lambda_invoke_url" {
  value = module.functions.lambda_invoke_url
}
