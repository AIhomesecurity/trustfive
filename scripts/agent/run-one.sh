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
if [[ "${OPENCODE_SKIP_QUOTA_CHECK:-0}" != "1" ]]; then
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
fi

# Leave ~16 minutes of the 45-minute GitHub job for npm install, TypeScript,
# build and draft-PR submission. More model time is not a quota guarantee.
# Never silently switch to a paid model.

OPENCODE_BIN="${OPENCODE_BIN:-opencode}"
BASE_HEAD="$(git rev-parse HEAD)"
NEXT_ENV_WAS_TRACKED=false
if git ls-files --error-unmatch next-env.d.ts >/dev/null 2>&1; then
  NEXT_ENV_WAS_TRACKED=true
fi

# Ensure dependencies exist without mutating package.json / lockfile during agent shell checks.
if [[ ! -d node_modules ]] && [[ "${OPENCODE_SKIP_NPM_INSTALL:-0}" != "1" ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
fi

# Provide safe loopback-only public Supabase config so /api/health returns 200
# when Playwright starts its webServer during unattended runs (never touches hosted DBs).
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_local_ci_fixture}"

# Pick an unused local port for Playwright webServer so stray listeners never cause EADDRINUSE.
if [[ -z "${PLAYWRIGHT_PORT:-}" ]]; then
  PLAYWRIGHT_PORT="$(node -e '
const net = require("node:net");
function tryPort(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(null));
    s.listen(port, "127.0.0.1", () => {
      const assigned = s.address().port;
      s.close(() => resolve(assigned));
    });
  });
}
(async () => {
  const chosen = (await tryPort(3112)) ?? (await tryPort(0));
  process.stdout.write(String(chosen));
})();
')"
fi
export PLAYWRIGHT_PORT

# Write a temporary project-level opencode.json (removed on EXIT) that explicitly
# denies interactive tools (Web Search, Web Fetch, interactive Question prompts,
# and external directory access) so headless `opencode run` never aborts with
# "Cancelled a request for input this run cannot answer: Web Search".
CREATED_OPENCODE_CONFIG=false
if [[ ! -f opencode.json ]]; then
  CREATED_OPENCODE_CONFIG=true
  cat > opencode.json <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "read", "resource": "*", "effect": "allow" },
    { "action": "edit", "resource": "*", "effect": "allow" },
    { "action": "glob", "resource": "*", "effect": "allow" },
    { "action": "grep", "resource": "*", "effect": "allow" },
    { "action": "list", "resource": "*", "effect": "allow" },
    { "action": "shell", "resource": "*", "effect": "allow" },
    { "action": "todowrite", "resource": "*", "effect": "allow" },
    { "action": "websearch", "resource": "*", "effect": "deny" },
    { "action": "webfetch", "resource": "*", "effect": "deny" },
    { "action": "question", "resource": "*", "effect": "deny" },
    { "action": "external_directory", "resource": "*", "effect": "deny" }
  ]
}
JSON
fi

kill_port_listeners() {
  local target_port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -TERM "${target_port}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti "tcp:${target_port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      kill -TERM $pids 2>/dev/null || true
    fi
  elif command -v ss >/dev/null 2>&1; then
    local pids
    pids="$(ss -ltnp "sport = :${target_port}" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)"
    if [[ -n "$pids" ]]; then
      kill -TERM $pids 2>/dev/null || true
    fi
  fi
}

cleanup() {
  if [[ "$CREATED_OPENCODE_CONFIG" == true ]]; then
    rm -f opencode.json
  fi

  # Terminate any stray local servers left on Playwright/fixture ports.
  kill_port_listeners "$PLAYWRIGHT_PORT"
  if [[ "$PLAYWRIGHT_PORT" != "3112" ]]; then
    kill_port_listeners 3112
  fi
  kill_port_listeners 54321
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -f "next-server" >/dev/null 2>&1 || true
  fi

  # If the agent created local commits during its turn, return them to the
  # working tree so the workflow's protected-path validator and draft-PR step
  # inspect and commit every change.
  local current_head
  current_head="$(git rev-parse HEAD)"
  if [[ "$current_head" != "$BASE_HEAD" ]]; then
    git reset --mixed "$BASE_HEAD" >/dev/null
  fi

  # Next.js build creates untracked next-env.d.ts; remove it so the workflow's
  # protected-path allowlist never fails on generated build scaffolding.
  if [[ "$NEXT_ENV_WAS_TRACKED" == false ]] && [[ -f next-env.d.ts ]]; then
    rm -f next-env.d.ts
  fi
}
trap cleanup EXIT

timeout --signal=TERM --kill-after=30s 29m \
  "$OPENCODE_BIN" run --standalone --archived --auto --model openrouter/openrouter/free \
  "$(cat scripts/agent/PROMPT.md)"
