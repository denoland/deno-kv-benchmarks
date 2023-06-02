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

if [[ ! $DENO_DEPLOY_FRONTEND_PROJECT ]]; then
  echo "Missing required env var: DENO_DEPLOY_FRONTEND_PROJECT" >&2
  exit 1
fi

# Set cwd to the directory of the provision dir relative
# to this Bash script
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
script_dir=$PWD
update_config_script=$script_dir/update-deno-kv-frontend.sh
provision_dir=$(dirname "$PWD")
frontend_proj_dir=$(cd "$provision_dir/../../frontend" && pwd)
shopt -s nullglob

deploy_frontend() (
  "$update_config_script" || {
    echo "error: failed to update the frontend config" >&2
    exit 1
  }

  cd "$frontend_proj_dir"
  deployctl deploy \
    --exclude='.vim' \
    --prod \
    --project "$DENO_DEPLOY_FRONTEND_PROJECT" \
    main.ts
)

deploy_frontend
