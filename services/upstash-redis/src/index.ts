import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";

export async function handler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: "This is a working lambda function. Probably?\nNow with cookies!",
    headers: {
      "X-Funny-Joke": "was-said-probably",
    },
  };
}