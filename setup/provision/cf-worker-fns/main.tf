terraform {
  required_providers {
    # Pinning provider versions in an attempt to help
    # with repeatability
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.6.0"
    }

    external = {
      source  = "hashicorp/external"
      version = "2.3.1"
    }
  }
}

variable "name" {
  type = string
}

variable "account_id" {
  type = string
}

variable "script_path" {
  type = string
}

variable "kv_namespace_binding" {
  type = string
}

variable "kv_namespace_id" {
  type = string
}

variable "wrangler_deno_script" {
  type = string
}

variable "service_secret" {
  type = string
}

variable "service_secret_header" {
  type = string
}

data "external" "deno_deployment_script" {
  program = ["deno", "run", "-A", var.wrangler_deno_script]

  query = {
    cf_account_id               = var.account_id
    cf_worker_name              = var.name
    cf_worker_script_file_path  = var.script_path
    cf_worker_kv_namespace_name = var.kv_namespace_binding
    cf_worker_kv_namespace_id   = var.kv_namespace_id
    service_secret              = var.service_secret
    service_secret_header       = var.service_secret_header
  }
}

output "worker_deployment_state" {
  value = data.external.deno_deployment_script.result
}
