#!/bin/bash

# Make sure that we have the required programs to run this script
required_programs=(
  deno
  deployctl
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
backend_proj_dir=$(cd "$provision_dir/../../services/deno-kv" && pwd)
config_file=$backend_proj_dir/src/config.json
terraform_state_file=$provision_dir/terraform.tfstate
shopt -s nullglob

deploy_backend() (
  local secret=$(jq '.outputs.backend_service_secret.value' < "$terraform_state_file")
  local secret_header=$(jq '.outputs.backend_service_secret_header.value' < "$terraform_state_file")
  local config_file_contents
  read -r -d '' config_file_contents <<CONFIG
{
  "DENO_KV_FRONTEND_SECRET": $secret,
  "DENO_KV_FRONTEND_SECRET_HEADER": $secret_header
}
CONFIG
  printf %s "$config_file_contents" > "$config_file"

  cd "$backend_proj_dir"
  deployctl deploy \
    --exclude='.vim' \
    --prod \
    --project "$DENO_DEPLOY_BACKEND_PROJECT" \
    src/index.ts

  rm -f "$config_file"
)

deploy_backend
