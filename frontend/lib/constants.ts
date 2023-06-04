export const measurementKey = "measurement";
export const measurementReadKey = "read";
export const measurementWriteKey = "write";
export const cachedRequestKey = "cached_request_time";
export const prettyServiceNames = {
  denokv: "Deno KV",
  upstashredis: "Upstash Redis",
  dynamodb: "DynamoDB",
  firestore: "Firestore",
  cloudflarekv: "Cloudflare KV",
} as const;
