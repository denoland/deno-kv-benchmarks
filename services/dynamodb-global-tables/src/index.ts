import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";

export async function handler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: "<h1>Serious AWS!</h1><p>DynamoDB <em>was called</em> a database 😌</p>",
    headers: {
      "content-type": "text/html; charset=UTF-8"
    },
  };
}