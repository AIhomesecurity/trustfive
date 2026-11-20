#!/usr/bin/env bash
set -euo pipefail

# Invoked only in a disposable GitHub-hosted runner with a dedicated free-model key.
# No GitHub, Supabase, Vercel or Stripe write tokens are available to this step.
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "::error::OPENROUTER_API_KEY must be configured in repository Actions secrets."
  exit 2
fi
test -f AGENTS.md
test -f scripts/agent/PROMPT.md
test -f package.json
test -d .git

# Check only read-only account quota metadata. No inference, charges or
# authentication details are printed. OpenRouter's API may omit its daily
# quota shape; when unknown, let OpenCode handle provider throttling.
set +e
python3 - <<'PY'
import json, os, sys, urllib.error, urllib.request
req = urllib.request.Request(
    "https://openrouter.ai/api/v1/key",
    headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"]},
)
try:
    with urllib.request.urlopen(req, timeout=12) as response:
        payload = json.load(response).get("data") or {}
except (urllib.error.URLError, ValueError, TimeoutError) as exc:
    print("::notice::OpenRouter quota metadata unavailable; cannot pre-verify free-model capacity.")
    sys.exit(0)
quota = payload.get("free_model_daily_requests")
if isinstance(quota, dict):
    left = quota.get("remaining")
    if isinstance(left, (int, float)) and left <= 0:
        print("::notice::OpenRouter free-model daily quota exhausted. Skipping agent generation safely.")
        sys.exit(42)
    if isinstance(left, (int, float)):
        print("::notice::Free-model requests remain; no paid model fallback allowed.")
else:
    print("::notice::OpenRouter did not expose a free daily request counter; no quota assertion made.")
PY
quota_exit=$?
set -e
if [[ "$quota_exit" == 42 ]]; then
  exit 0
elif [[ "$quota_exit" != 0 ]]; then
  exit "$quota_exit"
fi

# One bounded agent cycle; the scheduled workflow is responsible for resuming.
# Never silently switch to a paid model.
timeout --signal=TERM --kill-after=30s 21m \
  opencode run --model openrouter/openrouter/free \
  "$(cat scripts/agent/PROMPT.md)"
