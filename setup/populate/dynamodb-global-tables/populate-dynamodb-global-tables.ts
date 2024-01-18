import { ApiFactory } from "https://deno.land/x/aws_api@v0.8.1/client/mod.ts";
import {
  AttributeValue,
  DynamoDB,
  ScanInput,
} from "https://deno.land/x/aws_api@v0.8.1/services/dynamodb/mod.ts";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.187.0/path/mod.ts";

const batchInsertSize = 25; // Hard limit imposed by DynamoDB's API
const currentWorkingDir = dirname(fromFileUrl(import.meta.url));
let tableName = "";

type TerraformState = {
  outputs: {
    [outputName: string]:
      | { value: string; type: "string" }
      | { value: number; type: "number" }
      | { value: boolean; type: "bool" }
      | { value: Record<string, unknown>; type: "object" };
  };
};

try {
  const tfstateFilepath = join(
    currentWorkingDir,
    "../../provision/terraform.tfstate",
  );
  const tfstateContents = Deno.readTextFileSync(tfstateFilepath);
  const tfstate: TerraformState = JSON.parse(tfstateContents);

  const tableNameOutput = tfstate.outputs.dynamodb_table_name;
  tableName = tableNameOutput.type === "string" ? tableNameOutput.value : "";
} catch (_error) {
  // We don't care to handle any specific errors currently
}

if (!tableName) {
  console.error(
    "error: failed to get DynamoDB table name from the Terraform .tfstate. Did you run Terraform?",
  );
  Deno.exit(1);
}

const delay = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

type SerializedDynamoDbValue =
  | { N: string }
  | { S: string }
  | { BOOL: boolean }
  | { NULL: true }
  | { L: SerializedDynamoDbValue[] }
  | { M: Record<string, SerializedDynamoDbValue> };

function serialize(data: unknown): SerializedDynamoDbValue | undefined {
  switch (typeof data) {
    case "number": {
      return { N: String(data) };
    }

    case "string": {
      return { S: data };
    }

    case "boolean": {
      return { BOOL: data };
    }

    case "object": {
      if (data === null) {
        return { NULL: true };
      }

      // We only care about vanilla objects, arrays, and Date objects
      switch (data.constructor) {
        // Object.create(null) and normal object literals
        case undefined:
        case Object:
          break;

        case Date:
          return { S: (data as Date).toJSON() };

        case Array: {
          const values: SerializedDynamoDbValue[] = [];
          for (const item of (data as unknown[])) {
            const serialized = serialize(item);
            if (serialized !== undefined) {
              values.push(serialized);
            }
          }
          return { L: values };
        }

        // Some special object that we don't want
        default:
          return;
      }

      const values: Record<string, SerializedDynamoDbValue> = {};
      for (const key in data) {
        if (Object.hasOwn(data, key)) {
          const value = (data as Record<string, unknown>)[key];
          if (value !== undefined) {
            const serialized = serialize(value);
            if (serialized !== undefined) {
              values[key] = serialized;
            }
          }
        }
      }

      return { M: values };
    }
  }
}

async function countDynamoDbRecords(
  client: DynamoDB,
  tableName: string,
): Promise<bigint> {
  const scanParameters: ScanInput = {
    TableName: tableName,
    Select: "COUNT",
  };
  let lastKey: {
    ExclusiveStartKey: Record<string, AttributeValue | null | undefined>;
  } = { ExclusiveStartKey: {} };
  let count = 0n;

  while (lastKey.ExclusiveStartKey) {
    const scan = await client.scan({
      ...scanParameters,
      ...(lastKey.ExclusiveStartKey.id && lastKey),
    });
    lastKey = { ExclusiveStartKey: scan.LastEvaluatedKey! };
    count += BigInt(scan.Count || 0);
  }

  return count;
}

type GithubRepoRecord = {
  id: number;
  forks_count: number;
  full_name: string;
};

const datasetFilepath = Deno.readTextFileSync(
  join(currentWorkingDir, "../github-repo-dataset.json"),
);
const dataset: GithubRepoRecord[] = JSON.parse(datasetFilepath);
const client = new ApiFactory().makeNew(DynamoDB);

// Insert in `batchInsertSize` increments
for (let i = 0; i < dataset.length; i += batchInsertSize) {
  const batch = dataset
    .slice(i, i + batchInsertSize)
    .map((item) => {
      const serialized = serialize(Object.assign(item, {
        host: "github",
      }));

      return (serialized as { M: Record<string, SerializedDynamoDbValue> }).M;
    })
    .map((item) => ({
      PutRequest: {
        Item: item as Record<string, SerializedDynamoDbValue>,
      },
    }));

  while (true) {
    try {
      await client.batchWriteItem({
        RequestItems: {
          [tableName]: batch,
        },
      });
      // We succeeded in storing this batch
      break;
    } catch (error) {
      console.log("FAILED TO POPULATE BATCH: ", error);
      console.log("Waiting 20 seconds and trying again...");
      await delay(20e3);
    }
  }
}

const reportedCount = await countDynamoDbRecords(client, tableName);

console.log(`Inserted count: ${dataset.length}`);
console.log(`Reported count: ${reportedCount}`);
