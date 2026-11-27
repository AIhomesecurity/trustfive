#!/usr/bin/env bash
set -euo pipefail

preflight="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/db/check-migration-versions.sh"
fixtures=$(mktemp -d)
trap 'rm -rf -- "$fixtures"' EXIT

check_rejected() {
  local name=$1 expected=$2 output
  if output=$(cd "$fixtures/$name" && bash "$preflight" 2>&1); then
    echo "Expected preflight to reject $name" >&2
    exit 1
  fi
  if [[ $output != *"$expected"* ]]; then
    echo "Unexpected preflight output for $name: $output" >&2
    exit 1
  fi
}

mkdir -p "$fixtures"/{valid,duplicate,malformed,empty}/supabase/migrations
touch "$fixtures/valid/supabase/migrations/"{0001_core,0003_followup}.sql
touch "$fixtures/duplicate/supabase/migrations/"{0001_first,0001_second}.sql
touch "$fixtures/malformed/supabase/migrations/core.sql"

(cd "$fixtures/valid" && bash "$preflight")
check_rejected duplicate 'Duplicate migration version 0001'
check_rejected malformed 'Invalid migration filename: core.sql'
check_rejected empty 'No SQL migrations found'
echo 'Migration preflight accepted ordered versions and rejected duplicate, malformed and empty migration sets'
