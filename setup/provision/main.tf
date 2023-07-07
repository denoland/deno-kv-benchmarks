terraform {
  required_providers {
    # Pinning provider versions in an attempt to help
    # with repeatability
    aws = {
      source  = "hashicorp/aws"
      version = "4.66.1"
    }

    google = {
      source  = "hashicorp/google"
      version = "4.64.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.6.0"
    }
  }
}

# Configure the providers
provider "aws" {
  region = "us-west-2"
}

provider "google" {
  project = "deno-cloud-functions"
  region  = local.gcp_region
}

provider "cloudflare" {
  api_token = var.CLOUDFLARE_API_TOKEN
}

# Declare locals
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "random_id" "backend_service_secret" {
  byte_length = 32
}

locals {
    account_id                    = data.aws_caller_identity.current.account_id
    region                        = data.aws_region.current.name
    dynamodb_table_name           = "github_repos"
    dynamodb_table_gsi_index      = "github_repo_index"
    gcp_project_id                = "deno-cloud-functions"
    gcp_region                    = "us-west1" # Oregon similar to AWS
    gcp_firestore_collection      = "repos"
    cf_account_id                 = var.CLOUDFLARE_ACCOUNT_ID
    cf_kv_namespace               = "deno_kv_ns_store"
    backend_service_secret        = random_id.backend_service_secret.hex
    backend_service_secret_header = "x-backend-secret"
}

output "backend_service_secret_header" {
  value = local.backend_service_secret_header
}

output "backend_service_secret" {
  value = local.backend_service_secret
}

output "cf_account_id" {
  value = local.cf_account_id
}

output "cf_kv_namespace" {
  value = local.cf_kv_namespace
}

output "gcp_project_id" {
  value = local.gcp_project_id
}

output "gcp_firestore_collection" {
  value = local.gcp_firestore_collection
}

# Provided through environment variables
variable "UPSTASH_REDIS_HOST" {
  type = string
}

variable "UPSTASH_REDIS_PASSWORD" {
  type = string
}

variable "CLOUDFLARE_ACCOUNT_ID" {
  type = string
}

variable "CLOUDFLARE_API_TOKEN" {
  type = string
}