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

## How to setup the benchmark

1. Setup the various cloud providers with Terraform by following the
   instructions in the [provision README]. **All subsequent instructions
   must be run with the environment variables listed in the provision
   README.**
2. Deploy the Deno backend component by running the deployment script
   ```bash
   ./setup/provision/utils/deploy-deno-kv-backend.sh
   ```
3. Populate the newly provisioned databases by running the population
   script
   ```bash
   ./setup/populate/populate-databases.sh
   ```
4. Deploy the frontend by running the deployment script
   ```bash
   ./setup/provision/utils/deploy-deno-kv-frontend.sh
   ```
5. View the frontend by visiting the link output by the deployment
   script.

<!-- Links -->
[Deno KV]: https://deno.com/kv
[Upstash Redis]: https://upstash.com/redis
[AWS DynamoDB Global Tables]: https://aws.amazon.com/dynamodb/global-tables/
[Firestore]: https://firebase.google.com/docs/firestore
[Cloudflare Workers KV]: https://www.cloudflare.com/products/workers-kv/
[provision README]: ./setup/provision/README.md