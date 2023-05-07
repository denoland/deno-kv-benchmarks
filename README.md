# Deno KV vs Other Databases Benchmark
In an effort to benchmark Deno KV against other serverless databases,
this implements an application split into different services. Each service
measures read/write latency to databases and are hosted in a way to ensure
that the latency excludes any network latency—by e.g. provisioning both the
serverless function in the same AWS region as the respective database.

## Databases
 - [Deno KV]
 - [Upstash Redis]
 - [AWS DynamoDB Global Tables]
 - [Firestore]
 - [Cloudflare Workers KV]

<!-- Links -->
[Deno KV]: https://deno.com/kv
[Upstash Redis]: https://upstash.com/redis
[AWS DynamoDB Global Tables]: https://aws.amazon.com/dynamodb/global-tables/
[Firestore]: https://firebase.google.com/docs/firestore
[Cloudflare Workers KV]: https://www.cloudflare.com/products/workers-kv/