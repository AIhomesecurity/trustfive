# Quality lane checkpoint — 2026-11-21 11:42 UTC

## P0: preview build failure, independently reproduced from Vercel logs
- Exact inspected feature SHA: `9875b59c0768a8585f77acf1440486c6acfc46de`.
- Vercel deployment `dpl_2Z1a67qUaRxtbz9Ju9sS3fDVXLJd` is **ERROR**, not READY; build `npm run build` failed during TypeScript checking.
- Root cause reported at `app/jobs/page.tsx:38:3`: **Block-scoped variable 'territoryChecking' used before its declaration.**
- GitHub application workflow 44899397369 **failure**; database workflow 44899397477 **success** at the same SHA.
- Ownership: `app/jobs/page.tsx` belongs to main development lane. Do **not** concurrently patch from quality lane.
- Acceptance: main lane moves state declaration before first use (without changing eligibility semantics), runs `npm run build` and affected browser tests, commits a development-only fix, confirms both exact-SHA workflows succeed and a corresponding Vercel preview is READY. Recheck protected auth journeys separately. No deployment retries merely to test the existing broken SHA.
- Dependency: main lane's current jobs edits; safety risk: incorrectly changing the territory-check guard could allow an unverified job site or leak private location information.

## P0: authenticated journey acceptance still outstanding
- Acceptance: with authorised genuine accounts, prove customer signup and email callback, exact-address selection, job creation, active independently vetted eligible professional discovery, quote, booking, opt-in address disclosure and revocation, and genuine post-completion review; negative tests cover wrong user, wrong trade/territory, sixth professional, and no consent.
- Dependencies: working staging auth and verified provider participation; **never** manufacture approved participants or genuine reviews.
- Safety: prevent private addresses in URLs/logs and ensure server-side RLS enforces every step.

## P0: privileged database functions and five-slot integrity
- Supabase security advisor at 2026-11-21 11:42 UTC: 7 RLS-without-policy informational findings, 4 anonymously executable SECURITY DEFINER functions; authenticated SECURITY DEFINER functions also need scoped audit. These counts are advisories, not proof of exploit.
- Acceptance: inventory grants and expected public behavior per function; demonstrate anonymous caller cannot obtain private data or modify allocations, transactional cap of five under concurrent approvals, stable waitlist ordering, complaint/appeal permissions and no paid ranking override.
- Dependencies: existing security draft PRs #15–18; security lane owns SQL and RLS.
- Safety: avoid broad GRANT/REVOKE changes before verifying public search requirements and regression tests.

## P1: social, mobile and moderation acceptance
- Acceptance: phone viewport 360/390px and keyboard/screen reader tests for feeds, events, reporting and professional directory; moderation queue and abuse-rate tests prove reported content can be reviewed without exposing reporter identity.
- Dependencies: UX lane community changes; avoid overlapping source edits.
- Safety: do not publish user-generated private addresses, false reviews or unmoderated harmful content.

## Benchmark
Existing `docs/competitor-pages-ux-audit.md` already records public Checkatrade, TrustATrader, MyBuilder, Taskrabbit, Nextdoor and Facebook functional patterns. Preserve original code and design; prioritize task-led job posting, honest vetting/reviews, clear availability, local groups, reporting and privacy. This checkpoint does not assert that authenticated competitor flows were accessed.

## Verification boundary
Connected GitHub, Vercel and Supabase were actually read. No local application test was run in this quality checkpoint, no staging login was performed, and no production changes or live payments were made.
