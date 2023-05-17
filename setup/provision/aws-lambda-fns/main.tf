# Variables
variable "fns" {
  type = map(object({
    artifact_zip = string
    pathname = string
    variables = map(string)
  }))
}

variable "region" {
  type = string
}

variable "account_id" {
  type = string
}

# API Gateway
resource "aws_api_gateway_rest_api" "api" {
  name = "upstash-redis"
}

resource "aws_api_gateway_deployment" "lambda_deployment" {
  for_each    = var.fns
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = "deno-lambda-rest-deployment"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.method[each.key].id,
      aws_api_gateway_integration.integration[each.key].id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

output "lambda_invoke_url" {
  value = {
    for k, v in var.fns : k => "${aws_api_gateway_deployment.lambda_deployment[k].invoke_url}/${v.pathname}"
  }
}

resource "aws_api_gateway_resource" "resource" {
  for_each    = var.fns
  path_part   = each.value.pathname
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  rest_api_id = aws_api_gateway_rest_api.api.id
}

resource "aws_api_gateway_method" "method" {
  for_each      = var.fns
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource[each.key].id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  for_each                = var.fns
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.resource[each.key].id
  http_method             = aws_api_gateway_method.method[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda[each.key].invoke_arn
}

# Lambda
resource "aws_lambda_permission" "apigw_lambda" {
  for_each      = var.fns
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda[each.key].function_name
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${var.region}:${var.account_id}:${aws_api_gateway_rest_api.api.id}/*/${aws_api_gateway_method.method[each.key].http_method}${aws_api_gateway_resource.resource[each.key].path}"
}

resource "aws_lambda_function" "lambda" {
  for_each      = var.fns
  filename      = each.value.artifact_zip
  function_name = "${each.key}-fn"
  role          = aws_iam_role.role[each.key].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  environment {
    variables = each.value.variables
  }

  source_code_hash = filebase64sha256(each.value.artifact_zip)
}

# IAM
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "role" {
  for_each           = var.fns
  name               = "deno-lambda-${each.key}-key"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}
