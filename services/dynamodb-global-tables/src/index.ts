import { DynamoDB, QueryInput, AttributeValue } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";

const {
  DYNAMODB_TABLE_NAME,
  DYNAMODB_TABLE_GSI_INDEX,
  DENO_KV_FRONTEND_SECRET,
  DENO_KV_FRONTEND_SECRET_HEADER,
} = process.env as Record<string, string>;

const maxWrittenForksCount = 90000;
const forksField = "forks_count";

async function getTopN(
  tableName: string,
  indexName: string,
  limit: number,
  client: DynamoDB,
): Promise<GithubRepoRecord[]> {
  const queryParameters: QueryInput = {
    TableName: tableName,
    IndexName: indexName,
    Limit: limit,
    ScanIndexForward: false,
    KeyConditionExpression: `host = :host_name`,
    ExpressionAttributeValues: {
      ":host_name": {
        S: "github",
      },
    },
  };
  let lastKey: {
    ExclusiveStartKey: Record<string, AttributeValue>
  } = { ExclusiveStartKey: {} };
  let documentIds: unknown[] = [];

  while (documentIds.length < limit && lastKey.ExclusiveStartKey) {
    const queryResult = await client.query(queryParameters);
    lastKey = { ExclusiveStartKey: queryResult.LastEvaluatedKey! };
    documentIds.push(...queryResult.Items!);
  }

  const batchGetItemResult = await client.batchGetItem({
    RequestItems: {
      [tableName]: {
        Keys: documentIds.map((indexKeys) => ({
          id: (indexKeys as Record<string, AttributeValue>).id,
        })),
      },
    },
  });
  const documents = batchGetItemResult
    .Responses![tableName]
    .map((record) => unmarshall(record));

  return documents as GithubRepoRecord[];
}

const db = new DynamoDB({});

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

export async function handler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const { headers } = event;
  const isValidSecret = headers[DENO_KV_FRONTEND_SECRET_HEADER] === DENO_KV_FRONTEND_SECRET;
  if (!isValidSecret) {
    return {
      statusCode: 400,
      body: "",
    };
  }

  const readStart = performance.now();
  const records = await getTopN(
    DYNAMODB_TABLE_NAME,
    DYNAMODB_TABLE_GSI_INDEX,
    10,
    db,
  );
  const readLatency = performance.now() - readStart;

  const writeStart = performance.now();
  const recordsToWrite: Record<string, AttributeValue>[] = [];
  for (const record of records) {
    const newForksCount = Math.floor(Math.random() * maxWrittenForksCount * Math.random());
    recordsToWrite.push(marshall({
      ...record,
      forks_count: newForksCount,
    }));
  }
  await db.batchWriteItem({
    RequestItems: {
      [DYNAMODB_TABLE_NAME]: recordsToWrite.map((marshalledRecord) => ({
        PutRequest: {
          Item: marshalledRecord,
        },
      })),
    },
  });
  const writeLatency = performance.now() - writeStart;

  return {
    statusCode: 200,
    body: JSON.stringify({
      latencies: {
        read: readLatency,
        write: writeLatency,
      },
      records,
    }, null, 2),
    headers: {
      "content-type": "application/json",
    },
  };
}