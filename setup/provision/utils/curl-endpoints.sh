#!/bin/bash
# Primarily meant for testing the endpoints

# Make sure that we have the required programs to run this script
required_programs=(
  curl
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

# Get the directory of the provision dir relative
# to this Bash script
provision_dir=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"/.. && pwd)
terraform_state_file=$provision_dir/terraform.tfstate
shopt -s nullglob

secret=$(jq -r '.outputs.backend_service_secret.value' < "$terraform_state_file")
secret_header=$(jq -r '.outputs.backend_service_secret_header.value' < "$terraform_state_file")

curl -H "$secret_header: $secret" "$@"
