#!/bin/bash

provision_dir=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/..

export CLOUDFLARE_ACCOUNT_ID=$(jq '.outputs.cf_account_id' -r < "$provision_dir/terraform.tfstate")
export CLOUDFLARE_API_TOKEN=$TF_VAR_CLOUDFLARE_API_TOKEN

if [[ ! $CLOUDFLARE_ACCOUNT_ID ]]; then
  echo "error: failed to get CloudFlare Account ID from the Terraform .tfstate. Did you run Terraform first?" >&2
  exit 1
fi

if [[ ! $CLOUDFLARE_API_TOKEN ]]; then
  echo "error: missing \$CLOUDFLARE_API_TOKEN env variable" >&2
  exit 1
fi

wrangler "$@"