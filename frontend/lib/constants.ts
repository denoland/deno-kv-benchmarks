export const measurementKey = "measurement";
export const measurementReadKey = "read";
export const measurementWriteKey = "write";
export const cachedRequestKey = "cached_request_time";
export const serviceOpUnsortedBatchKey = "svc_op:";
export const serviceOpSortedBatchKey = "svc_op_sorted:";
export const newMeasurementNonceKey = "measurement_nonce";
export const maxDataPointsPerService = 10_000;
export const prettyServiceNames = {
  denokv: "Deno KV",
  upstashredis: "Upstash Redis",
  dynamodb: "DynamoDB",
  firestore: "Firestore",
  cloudflarekv: "Cloudflare KV",
} as const;
