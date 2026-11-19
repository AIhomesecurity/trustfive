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

# One bounded agent cycle; the scheduled workflow is responsible for resuming.
# Never silently switch to a paid model.
timeout --signal=TERM --kill-after=30s 21m \
  opencode run --standalone --auto --model openrouter/openrouter/free \
  "$(cat scripts/agent/PROMPT.md)"
