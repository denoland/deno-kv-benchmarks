terraform {
  required_providers {
    # Pinning provider versions in an attempt to help
    # with repeatability
    aws = {
      source  = "hashicorp/aws"
      version = "4.66.1"
    }

    google = {
      source = "hashicorp/google"
      version = "4.64.0"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = "us-west-2"
}

provider "google" {
  project     = "deno-cloud-functions"
  region      = local.gcp_region
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
    account_id = data.aws_caller_identity.current.account_id
    region = data.aws_region.current.name
    dynamodb_table_name = "github_repos"
    dynamodb_table_gsi_index = "github_repo_index"
    gcp_project_id = "deno-cloud-functions"
    gcp_region = "us-west1" # Oregon similar to AWS
    gcp_firestore_collection = "repos"
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