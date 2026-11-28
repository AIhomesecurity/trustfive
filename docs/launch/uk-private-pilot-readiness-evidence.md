# TrustFive UK Private-Pilot Readiness & Go/No-Go Evidence Report

- **Report Timestamp (UTC):** 2026-11-26
- **Release Candidate PR / Branch:** Draft PR #192 (`agent/agy-private-pilot-go-nogo` → `feature/verified-marketplace-core`, worktree `C:/Users/Gary/trustfive-pilot-190`)
- **Base & Included Reviewed PRs:** PR #190 (`3b97df7ef73ae6f4f7e4ec5ce77b0ece3f1f776e`) + Migration `0055` (`dca4ff4995d1feddaac4fa0c7f5f72b0949a3287`) + PR #194 (`8d0eaaa516d7446021a2a293304ef71129233ca5`, pre-deploy baseline SHA gate fix) + PR #193 (`76592479df9dd560b43a016825db12ed6db5543d` → `9ae1a56`, `tests/release/protected-preview-browser-smoke.mjs`)
- **Kept Separate:** Draft PR #191 (`agent/agy-opencode-runner-repair`, `0429bfb2d5b7bee69635185f1ab4400ee101a465`, CI-green scheduled OpenCode runner repair — intentionally separate from runtime release candidate)

---

## Executive Go / No-Go Verdict

**OVERALL PRIVATE-PILOT GO-LIVE STATUS: NOT READY YET — CODE & ARTIFACT READY FOR PREVIEW UPLOAD; HOSTED DEPLOY, FRESH DB SQL AUDIT, HOSTED SIGNED-IN JOURNEYS, ROLLBACK DRILL & NAMED PILOT OWNERS REMAIN OPEN.**

| Checklist Area | Status | Honest Summary |
| --- | --- | --- |
| **1. Single Release Candidate & Full CI** | **PASS (TECHNICAL GO)** | PR #190 + Migration `0055` + PR #194 + PR #193 combined cleanly on `agent/agy-private-pilot-go-nogo` (separate from `main`/production). All local application, release-gate, Worker smoke, Playwright E2E (290/290) and disposable PostgreSQL 16 (44 migrations, 19/19 readiness, 24/24 SQL contracts) checks pass. |
| **2. Isolated Preview Database (`niyfvoxiagvbonifuctv`)** | **PARTIAL — FRESH SQL CHECK BLOCKED** | Confirmed isolated URL `https://niyfvoxiagvbonifuctv.supabase.co` (distinct from shared `lkfkhjthdtcefrcaatsi`), GoTrue `v2.199.0` healthy (`200`), REST `trades`/`service_areas` (`200`), `community_post_media` (`401` `42501` — confirms migration `0055` table exists & denies `anon`), and real `.cloudflare/output` passes `check-preview-isolation.mjs`. Fresh direct SQL query of `supabase_migrations.schema_migrations` and `preview-schema-readiness.sql` requires `DATABASE_URL` / Supabase Management API token (absent in this CLI session; last Codex check 2026-11-25 recorded 44 migrations including `0055` as `20261125230907`, 19/19 checks, 0 auth users). |
| **3. Protected Preview Deploy, Access Check & Rollback** | **BASELINE VERIFIED — CANDIDATE UPLOAD & ROLLBACK BLOCKED ON `cf` AUTH** | Live `https://preview.trustfive.co.uk` verified 2026-11-26T20:08Z against isolated `#186` baseline (`e4b6bddf5349107b2f4d9afb92b500dd08894fa1`, Worker version `6c151197-1aa0-4ec8-9e37-2a20977df638` on account `91c29bde6edbde72c04744966a4d1a9d`): anonymous denied (`302`), `validate-preview.mjs` **PASS**, PR #193 `protected-preview-browser-smoke.mjs` **PASS** (5/5 routes). Isolated rollback target (`6c151197`, `#186`) is eligible (isolated `niyfvoxiagvbonifuctv`, additive `0055` compatible; `#162` `c2b070d8` in account `ba02971e` remains strictly ineligible). Prebuilt artifact dry-run gate passes `ok: true`; live `cf deploy --prebuilt` & rollback execution blocked because local `cf` CLI is not logged into account `91c29bde6edbde72c04744966a4d1a9d`. |
| **4. Signed-In Synthetic Journeys** | **LOCAL PASS — HOSTED BLOCKED ON #3 UPLOAD & PREVIEW DB ADMIN/CLEANUP** | All 6 journey families verified locally (290/290 Playwright + 24/24 disposable PostgreSQL 16 contracts + Worker smoke). Hosted execution against running candidate on `preview.trustfive.co.uk` requires (a) uploading candidate SHA to `trustfive-preview` and (b) `SUPABASE_SERVICE_ROLE_KEY` or disposable email confirmation + teardown access on `niyfvoxiagvbonifuctv` so synthetic `auth.users` can be confirmed, tested and deleted cleanly. |
| **5. Release Evidence & Pilot Owners** | **PENDING OWNER NAMES & POST-DEPLOY SYNC** | Exact candidate SHA, live baseline Access/smoke outputs and blockers are recorded below. **Pilot Support Owner** and **Pilot Moderation Owner** must be explicitly named by the business owner before marking ready (zero invented approvals or owners). |

---

## 1. Candidate Scope & Review Decisions

- **Included — PR #190 (`3b97df7ef73ae6f4f7e4ec5ce77b0ece3f1f776e`):** Integrated #185 (Social Slices 1–4, completed-work showcase + migration `0054`, preview schema readiness, prebuilt deploy gate), #186 (isolated preview runtime bindings in `cloudflare.config.ts`), and #187 (plaintext Worker binding hardening + PostgreSQL URI password rejection).
- **Included — Migration `0055` & Admin Moderation (`dca4ff4995d1feddaac4fa0c7f5f72b0949a3287`):** Admin-only `public.moderate_community_report(uuid, text)` (`hide` + `dismiss`), `public.community_post_media` EXIF-stripped raster RLS + 24/hr quota trigger, Social notification routes (`/community/social`, `/community/events`, `/community/social?tab=events`), 19/19 `preview-schema-readiness.sql`, `tests/db/social-moderation-media-rls-contract.sql`, and two-step hide/dismiss buttons on `app/admin/page.tsx`.
- **Included — PR #194 (`8d0eaaa516d7446021a2a293304ef71129233ca5`):** Fixed pre-deploy `validateProtectedPreviewEvidence` to validate the currently deployed baseline (`baselineCommitSha` + `baselineWorkerVersionId`) before candidate upload, eliminating the pre-deploy SHA mismatch.
- **Included — PR #193 (`76592479df9dd560b43a016825db12ed6db5543d` → `9ae1a56`):** Added `tests/release/protected-preview-browser-smoke.mjs` for origin-locked hosted Chromium verification of `/`, `/account`, `/jobs?trade=cctv-installation`, `/bookings`, and `/community` using scoped Cloudflare Access headers.
- **Kept Separate — PR #191 (`0429bfb2d5b7bee69635185f1ab4400ee101a465`):** Scheduled OpenCode unattended runner repair (`scripts/agent/run-one.sh`, `PROMPT.md`, `opencode-runner.test.mjs`), already CI-green and independent of runtime deployment.

---

## 2. Verified Live Hosted Baseline & Preview DB Isolation Checks (2026-11-26 UTC)

### Live Protected Preview (`https://preview.trustfive.co.uk`) — Running Baseline `#186`
- **Anonymous request (`curl.exe -sS -o NUL -w "%{http_code}" https://preview.trustfive.co.uk/api/health`):** `HTTP 302` (`Www-Authenticate: Cloudflare-Access` → `winter-rain-a9b9.cloudflareaccess.com`).
- **Authorised health (`CF-Access-Client-Id` / `CF-Access-Client-Secret`):** `HTTP 200` → `{"service":"trustfive-web","status":"ok","timestamp":"2026-11-26T20:06:34.153Z","commitSha":"e4b6bddf5349107b2f4d9afb92b500dd08894fa1"}`.
- **Hosted validator (`node scripts/release/validate-preview.mjs e4b6bddf5349107b2f4d9afb92b500dd08894fa1`):**
  `Private preview verified for e4b6bddf5349107b2f4d9afb92b500dd08894fa1` (exit `0`).
- **Hosted browser smoke (`node tests/release/protected-preview-browser-smoke.mjs e4b6bddf5349107b2f4d9afb92b500dd08894fa1`):**
  `Protected preview browser smoke passed for commit: e4b6bddf5349107b2f4d9afb92b500dd08894fa1`
  `Verified routes: /, /account, /jobs?trade=cctv-installation, /bookings, /community` (exit `0`).

### Live Read-Only Probes on Isolated Preview Supabase (`https://niyfvoxiagvbonifuctv.supabase.co`)
- Confirmed distinct from shared staging/production Supabase (`https://lkfkhjthdtcefrcaatsi.supabase.co`).
- `GET /auth/v1/health` → `HTTP 200` (`GoTrue v2.199.0`).
- `GET /rest/v1/trades?select=id,name&limit=3` → `HTTP 200` (Plumbing, Electrical, Cleaning).
- `GET /rest/v1/service_areas?select=id,area_name,city&limit=3` → `HTTP 200` (Central London, North London, Central Manchester).
- `GET /rest/v1/community_post_media?select=id&limit=1` → `HTTP 401` (`42501 permission denied for table community_post_media` — confirms migration `0055` relation is deployed and denies anonymous reads).
- `POST /rest/v1/rpc/{moderate_community_report,moderate_group_post_report,customer_job_activity,withdraw_job_quote}` with anon key → `HTTP 404` (`PGRST202` — confirms `REVOKE EXECUTE ... FROM anon`).
- **Pending fresh SQL check:** Direct `psql` / Supabase Management API verification of `supabase_migrations.schema_migrations` and `scripts/release/preview-schema-readiness.sql` against `niyfvoxiagvbonifuctv` (requires owner-held DB/Management credentials not present in this CLI session).

---

## 3. Exact Local Verification Commands & Pass/Fail Counts

| Suite | Exact Command | Result |
| --- | --- | --- |
| Migration version preflight | `bash tests/db/check-migration-versions.sh && bash scripts/db/check-migration-versions.sh supabase/migrations` | **PASS** (44 ordered migrations) |
| Disposable PostgreSQL 16 replay | `psql -v ON_ERROR_STOP=1 -f tests/db/bootstrap.sql` + 44 `supabase/migrations/*.sql` | **44/44 PASS** (exit `0`) |
| Preview schema readiness SQL | `psql -XAt -v ON_ERROR_STOP=1 -f scripts/release/preview-schema-readiness.sql` | **19/19 `t`** (exit `0`) |
| All CI SQL security & five-slot contracts | All 24 contracts from `.github/workflows/database-tests.yml` (rollback-only) | **24/24 PASS** (exit `0`) |
| Geo boundary tests | `node --test tests/geo/inspect-boundary-geojson.test.mjs` | **5 passed, 0 failed** |
| Release & deploy-gate unit tests | `node --test tests/release/*.test.mjs` | **33+ passed, 0 failed** (verified on combined tree below) |
| TypeScript & Next.js build | `npx tsc --noEmit && npm run build` | **PASS** (exit `0`) |
| Cloudflare Worker compile & local smoke | `npm run build:vinext && bash tests/release/cloudflare-worker-smoke.sh` (includes `signed-in-smoke.mjs 3008`) | **PASS** (exit `0`) |
| Full Playwright browser & mobile suite | `npx playwright test --reporter=list` | **290 passed, 0 failed, 4 skipped** (staging-only read-only specs) |
| Real isolated prebuilt artifact isolation | `node scripts/release/check-preview-isolation.mjs .cloudflare/output/v1/workers/default/assets` (`niyfvoxiagvbonifuctv` vs `lkfkhjthdtcefrcaatsi`) | **PASS** (exit `0`) |
| Prebuilt deploy gate dry-run (`--dry-run`) | `node scripts/release/deploy-preview-gate.mjs --dry-run ...` with live `#186` baseline evidence (`6c151197`, `e4b6bddf`) | **PASS** (`ok: true`, exact SHA-256 digest recorded in PR #192) |

---

## 4. Rollback Eligibility & Rehearsal Record

- **Eligible Isolated Baseline:** `#186` (`e4b6bddf5349107b2f4d9afb92b500dd08894fa1`, Cloudflare Worker version `6c151197-1aa0-4ec8-9e37-2a20977df638`, prebuilt digest `3a6a79c9773f24a7711590016362f94253d811425fa5e01ccc334f8ec63b96e2`, hosted on Cloudflare account `91c29bde6edbde72c04744966a4d1a9d` with isolated `niyfvoxiagvbonifuctv.supabase.co`).
- **Ineligible Version (NEVER USE):** `#162` (`c2b070d8-a598-4f41-b34c-3f22c064104a` in separate Cloudflare account `ba02971e74c95adaefff1d9cca9624cc`, bound to shared `lkfkhjthdtcefrcaatsi.supabase.co`, rejected by `check-preview-isolation.mjs` exit `1`).
- **Schema Compatibility:** Migration `0055` is strictly additive (`moderate_community_report`, `community_post_media`, expanded notification check constraints) and backwards-compatible with `#186` code.
- **Rehearsal Execution Status:** **BLOCKED** pending `cf login` / scoped `CLOUDFLARE_API_TOKEN` for account `91c29bde6edbde72c04744966a4d1a9d` to execute (1) `deploy-preview-gate.mjs --execute` for this exact candidate SHA, (2) rollback to `6c151197-1aa0-4ec8-9e37-2a20977df638` + Access/health/smoke verification, and (3) restore of the candidate version ID.

---

## 5. Pilot Operational Owners (Required Before Go-Live)

> **Never fabricate or assume operational owners.** The business owner must explicitly confirm and fill these roles before marking the private pilot ready:

| Role | Scope | Named Owner | Confirmation Status |
| --- | --- | --- | --- |
| **Pilot Support Owner** | Customer/professional onboarding assistance, booking/dispute escalation, password/account issues, incident response | *Pending owner nomination* | **BLOCKED — OWNER CONFIRMATION REQUIRED** |
| **Pilot Moderation Owner** | Community post/group reports (`moderate_community_report` / `moderate_group_post_report`), showcase moderation, abuse & complaint review | *Pending owner nomination* | **BLOCKED — OWNER CONFIRMATION REQUIRED** |
| **Independent Release & Vetting Approver** | Five-slot professional approvals, reviewed UK territory polygons, and 6 UK country release gates | *Pending independent reviewer confirmation* | **BLOCKED — OWNER CONFIRMATION REQUIRED** |

---

## 6. Exact Steps to Finish Hosted Rehearsal & Close Remaining Blockers

1. **Authenticate `cf` CLI to account `91c29bde6edbde72c04744966a4d1a9d`** (`npx cf login` or scoped `CLOUDFLARE_API_TOKEN`) and supply fresh `niyfvoxiagvbonifuctv` DB/Management read-only check output (`schema_migrations` + `scripts/release/preview-schema-readiness.sql` = `19/19 t`).
2. **Upload exact prebuilt artifact** for the final PR #192 commit SHA via `TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY=1 node scripts/release/deploy-preview-gate.mjs --execute ...` (no rebuild), then run `validate-preview.mjs <SHA>` and `protected-preview-browser-smoke.mjs <SHA>`.
3. **Execute hosted rollback drill**: roll `trustfive-preview` back to verified isolated baseline `6c151197-1aa0-4ec8-9e37-2a20977df638` (`e4b6bddf5349107b2f4d9afb92b500dd08894fa1`), verify Access + health + smoke, then restore the candidate version ID and verify again.
4. **Execute hosted synthetic signed-in journeys & cleanup** on `preview.trustfive.co.uk` / `niyfvoxiagvbonifuctv` (using disposable test accounts + `SUPABASE_SERVICE_ROLE_KEY` for test confirmation & full cleanup afterward; Stripe strictly in test mode).
5. **Confirm Pilot Support Owner & Pilot Moderation Owner** in Section 5 above and update this report once every running record matches the deployed SHA.
