#!/bin/bash

# Make sure that we have the required programs to run this script
required_programs=(
  npm
  deno
  zip
  rm
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

# Set cwd to the directory of this Bash script
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
provision_dir=$(dirname "$PWD")
modified_epoch=2023-05-04T07:30:00Z
shopt -s nullglob

# We need to reset the dates to a hard coded date on the
# modified files to make the .zip files reproducible
reset_file_modified_dates() {
  find . -exec touch -d "$modified_epoch" '{}' \;
}

build_function() (
  local service=$1
  local artifact_zip="$provision_dir/artifacts-$service.zip"
  cd "$provision_dir/../../services/$service"

  local deno_project=(deno.json*)
  local project_type=${deno_project[0]:+Deno}
  local project_type=${project_type:-Node}
  local checksum_files=
  local exit_status=

  printf "\n%s\n" "Building '$service' with $project_type..."

  if [[ $project_type = Deno ]]; then
    echo # Empty line

    rm -rf build
    deno task build
    exit_status=$?

    cd build
    reset_file_modified_dates
  else
    if [[ ! -d node_modules ]]; then
      printf "\n%s\n" "Installing dependencies..."
      npm ci
    fi

    rm -rf build
    npm run build
    exit_status=$?

    cd build
    reset_file_modified_dates

    rm -f "$artifact_zip"
    TZ=UTC zip -r "$artifact_zip" .
  fi

  exit $exit_status
)

services=(
  upstash-redis
  dynamodb-global-tables
  cloud-firestore
  cloudflare-workers-kv
)

for service in "${services[@]}"; do
  build_function "$service"
  status=$?

  if [[ $status != 0 ]]; then
    exit $status
  fi
done
