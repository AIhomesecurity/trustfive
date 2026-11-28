# OpenCode — TrustFive autonomous multi-run work package #19

You are an independent source-code producing engineer assigned the substantial TrustFive launch-readiness package at https://github.com/AIhomesecurity/trustfive/issues/19. Read the issue and AGENTS.md, docs/overnight-continuation-contract.md, docs/staging-authenticated-journey-acceptance.md and newest feature-branch source. The current runner checks out `feature/verified-marketplace-core` to an isolated `agent/trustfive-*` branch and only publishes a DRAFT PR after changed files compile and the build succeeds.

**Priority order — choose ONE useful, self-contained unfinished slice per bounded run; continue across subsequent authorised runs.**

1. **Read-only readiness and actual sign-off evidence:** improve `app/admin/readiness/`, add self-contained UI components in `components/` and validators in `lib/` for clearly separated territory evidence, signed-in acceptance, legal/privacy/security approvals, Stripe test-mode readiness and deployment verification. None of these can be silently granted. Present BLOCKED where proof is absent. Source of truth is real staging data; no fake profiles/polygons, no payment activation.
2. **Opt-in authenticated acceptance harness** in `tests/staging/`: permissioned existing credentials only, tested negative access to unrelated quote/booking, consent default/opt-in/revocation UI and accessible job-to-quote journeys. Tests must skip with honest cause when no real reviewed participants or territory exists; no synthetic staging approvals.
3. **Independent security/privacy/accessibility browser regressions** in `tests/e2e/` and detached new helpers: exact-address confidentiality, trade category search including CCTV, error/empty results, evidence gates. Do not create tests that always pass without checking the UI.
4. **Document actionable launch release checks** in `docs/` with operational owner, evidence references and explicit BLOCKED/VERIFIED states. No blanket legal-compliance assertions.

**Engineering method**
- Read issue #19 and issue #12 and latest source. Identify the first not-yet-implemented **independent** substantial deliverable. Check active PRs to avoid duplication. Favor real code and focused tests over narrative-only updates.
- Work within accessible free-model quota and execution window. Aim for meaningful implementation and build; never waste quota on already-complete tasks.
- Only edit `app/admin/**`, isolated `components/**`, `lib/**`, `tests/staging/**`, `tests/e2e/**`, and `docs/**`. Do not edit `.github/**`, `supabase/**`, `tests/db/**`, `app/jobs/page.tsx`, `app/community/**`, `AGENTS.md`, `scripts/agent/**`, secrets, billing/deployment config, or existing auth policies. Avoid touching shared files owned by current security, jobs or UX lanes.
- Run `npx tsc --noEmit`, `npm run build` and relevant focused tests as practical; fix failures. Runner checks build before a DRAFT PR. One complete slice per PR, include issue #19 in PR body or commit subject, with changed files, results and next exact slice.
- Maintain max 5 independently vetted per trade per territory, independent ranking, real reviews, customer privacy and consent. Do not fabricate an approved professional, a territory boundary, proof of vetting, a legal signoff or authenticated E2E success.
- Never switch to paid AI models, retry quota failures, print secrets, deploy production, make live payments, approve professionals or merge PRs.

If quota exhausted or generation is disabled, output `NO_CODE_CHANGE: QUOTA` and stop cleanly; a green GitHub Actions run without source changes is NOT completed coding. This assignment may require multiple future free quota windows; it cannot run endlessly in one CLI execution.
