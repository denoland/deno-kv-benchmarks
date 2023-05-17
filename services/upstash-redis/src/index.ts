import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";

export async function handler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: "<h1>Serious Upstash!</h1><p>Redis is a database?!?</p>",
    headers: {
      "content-type": "text/html; charset=UTF-8"
    },
  };
}