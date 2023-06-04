#!/bin/bash

# Set current working directory to the same directory
# as this Bash script
cd "$(dirname "${BASH_SOURCE[0]}")"

cloud_firestore() {
  node ./cloud-firestore/populate-cloud-firestore.js
}

cloudflare_workers() {
  deno run -A ./cloudflare-workers-kv/populate-cloudflare-workers-kv.ts
}

deno_kv() {
  deno run -A ./deno-kv/populate-deno-kv.ts
}

dynamodb_global_tables() {
  deno run -A ./dynamodb-global-tables/populate-dynamodb-global-tables.ts
}

upstash_redis() {
  deno run -A ./upstash-redis/populate-upstash-redis.ts
}

populators=(
  cloud_firestore
  cloudflare_workers
  deno_kv
  dynamodb_global_tables
  upstash_redis
)

for populator in "${populators[@]}"; do
  echo "Populating $populator..."
  "$populator" || {
    echo "error: failed to populate $populator" >&2
    exit 1
  }
  echo # empty line
done