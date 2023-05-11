#!/bin/bash

# Set cwd to the directory of this Bash script
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
script_dir=$PWD

build_function() (
  local service=$1
  cd "../../services/$service"

  echo "Building $service..."
  npm run build

  cd build
  zip -r "$script_dir/artifacts-$service.zip" .
)

services=(
  upstash-redis
  # dynamodb-global-tables
  # cloud-firestore
  # cloudflare-workers-kv
)

for service in "${services[@]}"; do
  build_function "$service"
done
