# AWS DynamoDB Database
# This is not a global table, the name is just from an earlier
# Terraform config revision
resource "aws_dynamodb_table" "dynamodb_global_table" {
  name             = local.dynamodb_table_name
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "id"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "id"
    type = "N"
  }

  # This will be hardcoded to "github" just to enable using the
  # DynamoDB query API with an index over the scan API
  attribute {
    name = "host"
    type = "S"
  }

  attribute {
    name = "forks_count"
    type = "N"
  }

  global_secondary_index {
    name            = local.dynamodb_table_gsi_index
    hash_key        = "host"
    range_key       = "forks_count"
    projection_type = "KEYS_ONLY"
  }
}

# Output to be reused by the DynamoDB populating script
output "dynamodb_table_gsi_index" {
  value = local.dynamodb_table_gsi_index
}

output "dynamodb_table_name" {
  value = local.dynamodb_table_name
}

# GCP Firestore Database
resource "google_firestore_database" "firestore" {
  name        = "(default)"
  location_id = local.gcp_region
  type        = "FIRESTORE_NATIVE"
}

# CloudFlare Workers KV Database
resource "cloudflare_workers_kv_namespace" "namespace" {
  account_id = local.cf_account_id
  title      = local.cf_kv_namespace
}

output "cf_kv_namespace_id" {
  value = cloudflare_workers_kv_namespace.namespace.id
}
