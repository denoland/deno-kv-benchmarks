variable "name" {
  type = string
}

variable "artifact_zip" {
  type = string
}

# GCP geographic region
variable "location" {
  type = string
}

variable "entry_point" {
  type = string
}

variable "firestore_collection" {
  type = string
}

variable "service_secret" {
  type = string
}

variable "service_secret_header" {
  type = string
}

resource "random_id" "bucket_id" {
  byte_length = 4
}

locals {
  google_storage_bucket_id = "${var.name}-gcf-source-${random_id.bucket_id.hex}"
}

output "google_storage_bucket_id" {
  value = local.google_storage_bucket_id
}

resource "google_storage_bucket" "bucket" {
  name     = local.google_storage_bucket_id  # Every bucket name must be globally unique
  location = "US"
  uniform_bucket_level_access = true
}

resource "google_storage_bucket_object" "object" {
  name   = "fn-${var.artifact_zip}"
  bucket = google_storage_bucket.bucket.name
  source = var.artifact_zip # Add path to the zipped function source code
}

resource "google_cloudfunctions2_function" "function" {
  name        = "deno-cloud-fn-deployment"
  location    = var.location
  description = "deno-cloud-fn-deployment"

  build_config {
    runtime     = "nodejs18"
    entry_point = var.entry_point  # Set the entry point 
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.object.name
      }
    }
  }

  service_config {
    max_instance_count = 4
    available_memory   = "256M"
    timeout_seconds    = 60

    environment_variables = {
      BACKEND_FIRESTORE_COLLECTION   = var.firestore_collection
      DENO_KV_FRONTEND_SECRET        = var.service_secret
      DENO_KV_FRONTEND_SECRET_HEADER = var.service_secret_header
    }
  }

  lifecycle {
    replace_triggered_by = [
      google_storage_bucket_object.object
    ]
  }
}

# IAM entry for all users to invoke the function
resource "google_cloud_run_service_iam_binding" "member" {
  location = google_cloudfunctions2_function.function.location
  service  = google_cloudfunctions2_function.function.name

  role    = "roles/run.invoker"
  members = [
    "allUsers",
  ]

  lifecycle {
    replace_triggered_by = [
      google_storage_bucket_object.object
    ]
  }
}

output "function_invoke_url" { 
  value = google_cloudfunctions2_function.function.service_config[0].uri
}
