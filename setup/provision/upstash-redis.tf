# Variables
locals {
  artifact_zip = "artifacts-upstash-redis.zip"
  pathname = "upstash-redis"
}

# API Gateway
resource "aws_api_gateway_rest_api" "api" {
  name = "upstash-redis"
}

resource "aws_api_gateway_deployment" "lambda_deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name = "deno-lambda-rest-deployment"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.method.id,
      aws_api_gateway_integration.integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

output "lambda_invoke_url" {
  value = "${aws_api_gateway_deployment.lambda_deployment.invoke_url}/${local.pathname}"
}

resource "aws_api_gateway_resource" "resource" {
  path_part   = local.pathname
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  rest_api_id = aws_api_gateway_rest_api.api.id
}

resource "aws_api_gateway_method" "method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.resource.id
  http_method             = aws_api_gateway_method.method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda.invoke_arn
}

# Lambda
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda.function_name
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${local.region}:${local.account_id}:${aws_api_gateway_rest_api.api.id}/*/${aws_api_gateway_method.method.http_method}${aws_api_gateway_resource.resource.path}"
}

resource "aws_lambda_function" "lambda" {
  filename      = local.artifact_zip
  function_name = "mylambda"
  role          = aws_iam_role.role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  source_code_hash = filebase64sha256(local.artifact_zip)
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
  name               = "myrole"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}
