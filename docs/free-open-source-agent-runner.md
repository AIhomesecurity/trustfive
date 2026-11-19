# TrustFive: free/open-source autonomous coding runner

Research date: 2026-11-19. This is a preparation document; **the runner is not installed, connected to OpenRouter, scheduled, or verified as working** merely because this document exists.

## Recommended components (use upstream originals)
1. **OpenCode** — https://github.com/anomalyco/opencode — open-source coding agent that runs headlessly (`opencode run`) and supports OpenRouter as a provider.
   - Official headless CLI documentation: https://opencode.ai/docs/cli/commands
   - Official OpenRouter integration: https://opencode.ai/docs/providers
2. **Ralph Workflow** — https://github.com/Ralph-Workflow/Ralph-Workflow — loop orchestrator with an OpenCode backend, persisted plan/build/verify/fix stages and bounded restarts. Use upstream documented installation. Treat its AGPL-3.0 license accordingly.
3. **OpenRouter free models** — https://openrouter.ai/collections/free-models — model router `openrouter/free` and rotating `:free` models, selected only after checking tool-use support and actual model availability. API key required. Free limits change; do not claim unlimited free inference.
4. **GitHub Actions** — https://docs.github.com/en/actions/concepts/billing-and-usage — public repository standard hosted runner usage is currently free subject to GitHub policy and technical limits. Schedule jobs or manual dispatch, and let them pick up backlog tasks on `feature/verified-marketplace-core`. Schedules execute workflows from the default branch, so account for this before making any auto-run claims.

## One-time owner prerequisites
- Create an OpenRouter API key at https://openrouter.ai/keys . Never paste keys in chat, commit them into code, print them in logs or supply them to untrusted third-party automation repos.
- Install the secret as `OPENROUTER_API_KEY` in GitHub repository Settings → Secrets and variables → Actions. Secrets cannot be securely set through the current limited connected GitHub content tools; treat this as an explicit blocker.
- Review GitHub repository Actions permissions and confirm that GitHub Actions can create PRs, or use a tightly scoped GitHub App token. Do not enable unrestricted write permissions.
- If using a local/self-hosted runner, keep the machine on, dedicated and patched; don't run untrusted pull-request code with secrets.

## Safe first pilot
- Run OpenCode locally or in an isolated runner with `OPENROUTER_API_KEY` injected from a secret, using a genuine free tool-capable model such as one discovered via `opencode models openrouter`; `openrouter/openrouter/free` may require model catalog support. Check current docs and availability before choosing.
- Start with **one** low-risk GitHub issue and a bounded number of iterations (e.g. 3), not an unbounded loop.
- Read `AGENTS.md` and `docs/competitor-pages-ux-audit.md`; do not treat the backlog as approval for production launch.
- Work in a new branch based on `feature/verified-marketplace-core`. Do not directly push to `main` or deploy real payments.
- Give the agent only repository read/write, shell/build/test in an isolated environment, and scoped PR permissions. No Supabase production, production environment variables, live Stripe secrets, repo administration or broad organization credentials.
- Require a clear task + acceptance tests. Check `npm ci`, TypeScript/build, Playwright, DB integration via CI, diff inspection and security scans; open a draft PR back to feature branch, no auto-merge.
- On failure or quota exhaustion, stop safely, preserve task state and log next action. A scheduler may resume in a new bounded run; it is not a promise of limitless continuous execution.

## Pilot tasks to validate
1. Make /jobs form preserve trade and area across authentication on staging, without redirect exploits.
2. Improve one approved business profile from real verified database records; never invent ratings or providers.
3. Add targeted Playwright tests for an authenticated customer-to-booking staging journey with isolated fixtures, not real accounts.

## Further compatible alternatives
- **Kilo Code** https://github.com/Kilo-Org/kilocode — OpenCode-derived CLI, headless `kilo run --auto`, free-model routing; investigate model quotas and audit code before adopting.
- **OpenHands** https://github.com/OpenHands/OpenHands — open-source coding agent and self-hosted agent environment; larger infrastructure footprint.
- **Aider** https://github.com/Aider-AI/aider — lightweight code editing; orchestration must be supplied separately.
- **Ralph CLI** https://github.com/gilbitron/ralph-cli — simple OpenCode iterative runner; smaller project with limited adoption compared with upstream.
- **Coding Factory** https://github.com/Thanh410/coding-factory — advertises unattended coding pipeline including OpenRouter free model routing; requires independently evaluating external code, permissions and token handling before installing it into TrustFive.

## Security/operational cautions
- Don't expose the OpenRouter API key or existing Supabase/Vercel service secrets to arbitrary third-party agents.
- Treat model outputs and issue descriptions as untrusted; do not allow agent instructions to override repository trust boundaries.
- Avoid automatic merging, branch protection changes, paid API fallback or unlimited retries.
- Free hosted inference has availability and rate limits. If true continuous inference is needed, investigate local Ollama on owned hardware, understanding hardware and electricity costs and lower-quality models.
- GitHub free execution, available free models and repository owner approval are separate prerequisites.
- This plan does **not** install a live 24/7 agent; successful startup and at least one verified pilot run are required before making that claim.

## Useful first execution
After the owner securely installs the OpenRouter key, test a **manual** read-only OpenCode run against a fork or safe ephemeral checkout, confirm exactly $0 model pricing, then add a guarded GitHub Actions `workflow_dispatch` proof of concept and run it. Only after a green pilot add schedule + a persistent queue and stage-only PR output.
