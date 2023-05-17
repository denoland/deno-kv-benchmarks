resource "aws_dynamodb_table" "dynamodb_global_table" {
  name           = local.dynamodb_table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

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
    name               = local.dynamodb_table_gsi_index
    hash_key           = "host"
    range_key          = "forks_count"
    write_capacity     = 50
    read_capacity      = 50
    projection_type    = "KEYS_ONLY"
  }

  # Global tables. The DB is already provisioned in us-west-2
  # so it's omitted
  replica {
    region_name = "us-east-1"
  }

  replica {
    region_name = "us-west-1"
  }

  replica {
    region_name = "eu-west-1"
  }

  replica {
    region_name = "eu-central-1"
  }

  replica {
    region_name = "ap-southeast-1"
  }

  replica {
    region_name = "ap-southeast-2"
  }

  replica {
    region_name = "sa-east-1"
  }
}

# Output to be reused by the DynamoDB populating script
output "dynamodb_table_gsi_index" {
  value = local.dynamodb_table_gsi_index
}

output "dynamodb_table_name" {
  value = local.dynamodb_table_name
}
