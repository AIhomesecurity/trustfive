# TrustFive agent handoff: bounded Lovable work → canonical GitHub

**Status:** Lovable connection is available to ChatGPT, but direct synchronization to this repository has **not** been verified. This document describes reviewable handoff, not automatic Lovable-to-GitHub pushes.

## Canonical source and guardrails
- Canonical: `AIhomesecurity/trustfive`, `feature/verified-marketplace-core`, draft PR #1 targeting `development/foundation`. Production/main must not be changed without explicit owner approval.
- Secondary prototype: Lovable project `69558021-69b4-4166-b6be-ea01ba47fdb0` (TrustFive Experience Lab), separate stack, no real customer data. Existing SecureSite Planner Lovable project is unrelated and must remain untouched.
- GitHub issue #12 is the master delivery checklist; issue #11 covers geocoded job routing and address privacy.
- Lovable workspace plan reported by the connected API as `free` on 2026-11-19, despite owner's report of a paid subscription. Avoid assuming billable/daily quotas; verify in the Lovable billing UI before spending. No unlimited or 10-minute ChatGPT background execution claims.

## Mandatory checkpoint algorithm — one bounded slice per agent turn
1. **Inspect** current GitHub head/CI, Lovable project status and latest saved diff. Avoid duplicating work.
2. **Scope** a single accessible visual/UX component that can finish within the current model/credit allowance. Prefer complete customer-visible improvement to an unfinished multi-page redesign.
3. **Build** only in the secondary Lovable prototype; do not provision a new production database, connect live payments, or publish the app.
4. **Checkpoint in Lovable:** save final edited files, record exact paths and an edit/commit identifier, describe acceptance checks, known limitations and unresolved dependencies.
5. **Handoff through GitHub tooling:** inspect the actual Lovable diff and port only approved original useful UI to the canonical Next.js code (adapt TanStack/React code; never overwrite repo wholesale), using a small commit on the feature branch. **Do not treat Lovable save as GitHub sync.**
6. **Verify:** GitHub application CI and database integration when relevant; inspect and fix failures. Check authenticated staging workflows when credentials and approved accounts are available.
7. **Report:** record GitHub commit SHA, test run links, the Lovable source edit, status and next specific task in GitHub issue #12. Check off an item only after relevant verification.

## Stop / budget / privacy safeguards
- If remaining credits or allowed execution cannot be inspected, keep each request narrow; don't launch a large project because the reported paid plan may have spare credits.
- Never expose GitHub secrets, API keys, customer addresses, private verification notes, service role credentials or customer identity details in Lovable prompts or GitHub issues.
- Maximum five active independently approved professionals per trade and verified territory, plus fair eligible waiting list. Payment cannot influence ranking. Never seed fake reviewed businesses or fake completed bookings in live/staging databases.
- Customer full property address is private until explicit booked-customer consent; never copy it into public UI, logs or frontend URLs. Geographic boundaries require independent approval, no postcode-city guessing.
- Inability to connect or push from Lovable to GitHub is a blocker to **automatic synchronization**, not an excuse to imply that a commit happened. Use ChatGPT's connected GitHub tools for explicit review/port after Lovable writes code.
