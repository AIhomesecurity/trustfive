# TrustFive AionUI multi-agent handoff

This file is a GitHub-based work handoff to an **AionUI instance running on the owner's computer**. It is not a live ChatGPT→AionUI connection. AionUI must itself pull this repository, authenticate its own Codex/OpenCode/Gemini CLIs, and execute jobs locally. No model has been dispatched by creating this document.

## Canonical target and safety
- Repository: `https://github.com/AIhomesecurity/trustfive`
- Target integration branch: `feature/verified-marketplace-core`
- Main draft pull request: #1 (do not merge into `main` or `development/foundation`)
- Master completion issue: #12; follow `AGENTS.md`.
- Every agent uses its **own** branch from fresh target HEAD, with one narrowly scoped task per PR.
- Never include credentials, customer addresses, private data, fake approved professionals, fake reviews, live charges or external access tokens in a model prompt or PR.
- Do not invoke paid models, purchase credits, or change production without separate explicit permission. Respect existing CLI/auth provider limits.
- Run `npm install --no-audit --no-fund`, `npx tsc --noEmit`, `npm run build`, and `npm run test:e2e` when applicable. Database/RLS changes additionally require PostgreSQL integration tests and careful review.
- If the CLI cannot authenticate or a model quota is exhausted, stop that lane without retry loops. Leave diagnostics in a draft PR or issue, and let another independently authorised lane continue.
- Don't edit the same files in multiple branches at the same time.

## Task A — Codex: booking workflow reliability
Branch suggestion: `agent/aionui-booking-reliability`.

Inspect `app/bookings/page.tsx`, `app/schedule/page.tsx`, `app/messages/page.tsx`, `lib/workflow-links.ts`, `tests/e2e/public-routes.spec.ts`. Select a focused reliability or accessibility gap in **authenticated** customer/verified-professional booking lifecycle. Implement source+tests and document what cannot be authenticated on staging. Preserve exact-address consent defaults and authority of database RPC checks. Do not change professional selection policy.

## Task B — Gemini CLI: isolated security review
Branch suggestion: `agent/aionui-security-review`.

Read latest migrations and `tests/db/` plus `AGENTS.md`. Perform static review of RLS, `SECURITY DEFINER` executable grants, five-slot concurrency, exact-address consent and stale authorisation. Deliver a short report in `docs/security/` or a single tight negative regression test in `tests/db/`. No production SQL execution; no blanket grants or permissive policies. Do not alter booking/messaging UI files used by Task A.

## Task C — OpenCode: community mobile UX
Branch suggestion: `agent/aionui-community-mobile`.

When OpenRouter/free-model capacity permits, inspect `app/community/` and related components. Deliver one concrete mobile/accessibility improvement with browser regression tests. Do not edit shared `app/globals.css` while another agent is modifying it—use scoped component CSS or coordinate a separate small styling commit. Never claim quota is available without checking.

## Shared reporting and integration
Each agent should:
1. `git fetch origin` and checkout its own branch created from the latest `origin/feature/verified-marketplace-core`.
2. Implement exactly one complete, independently testable slice, not a speculative rewrite.
3. Commit source + tests and open a **draft PR targeting `feature/verified-marketplace-core`** with original file paths, exact commit SHA, test commands/results, privacy considerations and unresolved issues.
4. Do not auto-merge. ChatGPT/GitHub engineering review will inspect PRs for collisions, test CI and manually integrate safe changes into the canonical branch.
5. Repeat only while local AionUI scheduler/agent capacity and user-authorised usage limits permit.

## AionUI operator prompt
```text
In my local AionUI, use the connected coding agents to work on the existing
AIhomesecurity/trustfive GitHub repository. Read AGENTS.md and
docs/aionui-agent-handoff.md on feature/verified-marketplace-core first.
Delegate Task A to Codex, Task B to Gemini CLI and Task C to OpenCode only if
each CLI is authenticated and within its free/authorised quota.
Use separate feature branches and draft PRs into
feature/verified-marketplace-core. Run tests before publishing a PR.
Do not change production, merge automatically, send private data to models,
or incur new paid API usage. Leave precise commit SHAs and CI evidence.
```
