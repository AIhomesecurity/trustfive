#!/usr/bin/env bash
set -euo pipefail

base_url=http://127.0.0.1:3008
log=$(mktemp)
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 3008 --strictPort >"$log" 2>&1 &
worker_pid=$!

cleanup() {
  local status=$?
  if (( status != 0 )); then cat "$log"; fi
  kill "$worker_pid" 2>/dev/null || true
  wait "$worker_pid" 2>/dev/null || true
  rm -f "$log"
}
trap cleanup EXIT

for attempt in {1..30}; do
  if health=$(curl --silent --fail --max-time 2 "$base_url/api/health"); then
    break
  fi
  kill -0 "$worker_pid"
  sleep 1
done
HEALTH_RESPONSE="$health" node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const response = JSON.parse(process.env.HEALTH_RESPONSE);
assert.equal(response.service, 'trustfive-web');
assert.equal(response.status, 'ok');
JS

node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3008';
const destination = '/jobs?trade=cctv-installation';
const result = await fetch(origin + destination, {
  redirect: 'manual',
  signal: AbortSignal.timeout(5000),
});
assert.equal(result.status, 307);
const location = new URL(result.headers.get('location'), origin);
assert.equal(location.pathname, '/account');
assert.equal(location.searchParams.get('next'), destination);
console.log('Local Cloudflare Worker health and signed-out job return checks passed');
JS
