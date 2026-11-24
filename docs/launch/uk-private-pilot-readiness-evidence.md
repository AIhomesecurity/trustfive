# TrustFive UK Private-Pilot Readiness Evidence

**Verdict: READY FOR OWNER-APPROVED ISOLATED PRIVATE PREVIEW REHEARSAL ONLY — NO-GO FOR PRODUCTION LAUNCH OR LIVE PAYMENTS.**

This document records verified local release-candidate evidence on branch `agent/agy-release-lead-1124` (based on PR #179 `d3b7ab3`) alongside explicitly blocked hosted and owner-only acceptance gates. Nothing in this document authorises production deployment, live Stripe charges, unverified territory approvals, or synthetic professional approvals.

## 1. Integrated Candidate Slices

- **Base:** PR #179 (`d3b7ab3` — includes #174 private preview isolation and OpenCode #175/#176/#178).
- **Social integration (PR #177 — 5 reviewable slices):** unified Social home and 360px mobile navigation, two-group membership visibility and report-to-hide/dismiss resolution, session-safe draft recovery and keyboard a11y, event RSVP reminders and `.ics` calendar export with honest notification channel states, and media privacy pre-check / spam / quota controls / filtered moderation queue.
- **Reviewed supporting drafts integrated:**
  - PR #161 (CCTV and alarm service request aliases) — verified already present in base `d95a75a`.
  - PR #173 — 360px mobile header keyboard Tab/Enter navigation and `aria-current="page"`.
  - PR #169 — fixed-clock professional vacancy offer expiry boundary tests.
  - PR #171 — private preview rollback rehearsal evidence record in `docs/hosting-decision.md`.
  - PR #172 — hosted booking rehearsal fixture cleanup runbook in `docs/staging-authenticated-journey-acceptance.md`.
- **Protected Cloudflare preview gate & guarded Ollama handoff:**
  - `cloudflare.config.ts` disables public `workersDev` and `previewUrls` and binds only `preview.trustfive.co.uk` (`previews: false`) on `trustfive-preview`.
  - `scripts/release/deploy-preview-gate.mjs` verifies the exact prebuilt `.cloudflare/output/v1` artifact (embedded `/api/health` commit SHA, server bundle + browser asset Supabase isolation, generated `worker.config.json` target, bindings, and URL exposure, plus SHA-256 artifact fingerprinting), requires genuine protected-preview Access denial evidence before `--execute`, and deploys ONLY the verified prebuilt artifact via the installed Cloudflare CLI (`cf deploy --prebuilt --mode production --worker trustfive-preview --no-provision --tag <sha>`) with zero rebuild.
  - `scripts/agent/ollama-handoff.mjs` enforces local loopback Ollama endpoints only, automatically records patch/commit or failure status, originating SHA, test evidence and destination to the coordinator inbox (`events.jsonl` and `reports/`), redacts secrets, forbids raw model deployments, and restricts GitHub draft PR eligibility to independently reviewed passing commits.
- **Post-integration pilot hardening slices:**
  - Professional availability confirmed busy windows and half-open `[start, end)` overlap guards on `/schedule`.
  - Complaints, no-shows and disputes lifecycle hardening on `/support/complaints` and `/admin/complaints` (including per-case draft isolation fix and two-step admin confirmation; zero automatic suspension).
  - Notification refresh failure preservation and per-item mark-read recovery on `/notifications`.
  - Stripe test-mode webhook `livemode` blocking and `Cache-Control: no-store` enforcement (from reviewed PR #29).

## 2. Guardrails & Invariants Preserved

| Invariant | Status | Verification |
| --- | --- | --- |
| Max 5 independently approved active professionals per trade & local area | Preserved | PostgreSQL 16 replay (`flows.sql`, `professional-onboarding-five-slot-contract.sql`) |
| Fair waiting list & payment-independent ranking | Preserved | PostgreSQL 16 replay (`flows.sql`, `distance_quality_ranking`, `professional-onboarding-five-slot-contract.sql`) |
| Private customer addresses & revocable booking consent | Preserved | PostgreSQL 16 replay (`private-booking-contract.sql`, `private-table-directory-negative-contract.sql`) + Playwright E2E |
| No live money / Stripe test-mode-only boundary | Preserved | Checkout requires `sk_test_`; webhook rejects `event.livemode === true` (403) + `Cache-Control: no-store` |
| No uncoordinated SQL migrations added | Preserved | 42 existing migrations replayed cleanly from empty PostgreSQL 16 |
| Zero hosted DB writes, zero production merges/deploys | Preserved | All local rehearsals run against loopback fixtures and ephemeral PostgreSQL 16 containers |

## 3. Explicitly Blocked Steps (Owner Action Required)

| Gate | Status | Owner Prerequisite |
| --- | --- | --- |
| Isolated preview Supabase backend confirmation | **BLOCKED** | Owner confirms dedicated preview Supabase project URL (distinct from production) and approves migration verification via `scripts/release/preview-schema-readiness.sql` |
| Protected preview Cloudflare Worker upload (`trustfive-preview`) | **BLOCKED** | Owner supplies preview Supabase URL/publishable key, verifies `check-preview-isolation.mjs` + `deploy-preview-gate.mjs --dry-run`, and explicitly sets `TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY=1` |
| Hosted authenticated registration, password recovery, booking-to-review & Social rehearsal | **BLOCKED** | Requires isolated preview backend + Cloudflare Access service token (`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`) + disposable synthetic test identities |
| Hosted preview rollback rehearsal | **BLOCKED** | Requires baseline & candidate Worker version IDs on `trustfive-preview`; record results in `docs/hosting-decision.md` table |
| Independent UK legal, privacy, payments, security, operations & territory sign-offs | **BLOCKED** | Genuine independent human reviewers must complete all 6 country gates in `docs/launch/uk-first-financial-legal-operations-signoffs.md` and reviewed polygons in `docs/launch/uk-pilot-boundary-evidence.md` |
