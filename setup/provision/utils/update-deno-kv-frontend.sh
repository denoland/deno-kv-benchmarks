#!/bin/bash

# Make sure that we have the required programs to run this script
required_programs=(
  jq
)
programs_not_found=()

for program in "${required_programs[@]}"; do
  if ! which "$program" &> /dev/null; then
    programs_not_found+=("$program")
  fi
done

if [[ ${#programs_not_found[@]} -gt 0 ]]; then
  IFS=','
  echo "error: missing required programs: ${programs_not_found[*]}" >&2
  exit 1
fi

if [[ ! $DENO_DEPLOY_BACKEND_PROJECT ]]; then
  echo "Missing required env var: DENO_DEPLOY_BACKEND_PROJECT" >&2
  exit 1
fi

# Set cwd to the directory of the provision dir relative
# to this Bash script
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
provision_dir=$(dirname "$PWD")
frontend_proj_dir=$(cd "$provision_dir/../../frontend" && pwd)
config_file=$frontend_proj_dir/lib/config.json
terraform_state_file=$provision_dir/terraform.tfstate
shopt -s nullglob

update_frontend_config() (
  local secret=$(jq '.outputs.backend_service_secret.value' < "$terraform_state_file")
  local secret_header=$(jq '.outputs.backend_service_secret_header.value' < "$terraform_state_file")
  local backend_denokv_svc_url=\"https://$DENO_DEPLOY_BACKEND_PROJECT.deno.dev/top-10\"
  local backend_upstashredis_svc_url=$(jq '.outputs.lambda_invoke_url.value["upstash-redis"]' < "$terraform_state_file")
  local backend_dynamodb_svc_url=$(jq '.outputs.lambda_invoke_url.value["dynamodb-global-tables"]' < "$terraform_state_file")
  local backend_firestore_svc_url=$(jq '.outputs.function_invoke_url.value' < "$terraform_state_file")
  local backend_cloudflarekv_svc_url=$(jq '.outputs.cf_wrangler_output.value.worker_url' < "$terraform_state_file")

  backend_firestore_svc_url=${backend_firestore_svc_url%\"}/top-10\"
  backend_cloudflarekv_svc_url=${backend_cloudflarekv_svc_url%\"}/top-10\"

  # TODO: Rewrite this to build the JSON with a single `jq` invocation
  # instead of this flimsy Bash stuff...
  local config_file_contents
  read -r -d '' config_file_contents <<CONFIG
{
  "DENO_KV_FRONTEND_SECRET": $secret,
  "DENO_KV_FRONTEND_SECRET_HEADER": $secret_header,
  "backend_service_urls": {
    "denokv": $backend_denokv_svc_url,
    "upstashredis": $backend_upstashredis_svc_url,
    "dynamodb": $backend_dynamodb_svc_url,
    "firestore": $backend_firestore_svc_url,
    "cloudflarekv": $backend_cloudflarekv_svc_url
  }
}
CONFIG
  mkdir -p "$(dirname "$config_file")"
  printf %s "$config_file_contents" > "$config_file"
)

update_frontend_config
