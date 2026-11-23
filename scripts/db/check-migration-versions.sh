#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
migrations=(supabase/migrations/*.sql)
if (( ${#migrations[@]} == 0 )); then
  echo 'No SQL migrations found' >&2
  exit 1
fi

declare -A versions
for migration in "${migrations[@]}"; do
  filename=${migration##*/}
  if [[ ! $filename =~ ^([0-9]+)_[^/]+\.sql$ ]]; then
    echo "Invalid migration filename: $filename" >&2
    exit 1
  fi
  version=${BASH_REMATCH[1]}
  if [[ -v versions[$version] ]]; then
    echo "Duplicate migration version $version: ${versions[$version]} and $filename" >&2
    exit 1
  fi
  versions[$version]=$filename
done
echo "Validated ${#migrations[@]} migration versions"
