# OpenCode release-readiness matrix — overnight integration challenge

**Verdict: NO-GO for production merge or deployment.** All work below is on
independent draft PRs against `feature/verified-marketplace-core`; no branch was
merged and no production, live Supabase, paid or credential-bearing resource
was used.

| Area | Status | Exact evidence |
| --- | --- | --- |
| Integration rehearsal of #28/#31/#32/#36/#40 | PASS locally | PR #43 head `256cc1921f4f6ef5b5d316ea9a3952b39ab17994`: four migrations renumbered to unique 0036/0037/0038/0039 with byte-identical SQL bodies; all four DB workflow contract groups retained; 57/57 disposable PostgreSQL 16 steps PASS. |
| Reproducible install / build | PASS locally | PR #43: `npm ci` PASS, `npx tsc --noEmit` PASS, `npm run build` PASS. PR #44 head `44cb29e4ec6fd11486dbad2df9be44107ee0e18d`: same three checks PASS. |
| Lint gate | PARTIAL | PR #35 has ESLint 9 flat config and zero baseline, but this integration base does not include it. PR #43/#44 bases have no ESLint dependency/config, so lint was not run there. Merged integration must include PR #35's gate. |
| Browser tests | PASS locally | PR #43: 115 passed / 1 known env failure / 4 skips. PR #44: after the hermetic fix, **102 passed / 0 failed / 4 opt-in skips** on the newer base. No skip was counted as a pass. |
| Migration production deploy | BLOCKED | Renumbering is proven only in the disposable rehearsal; the original PRs still collide. Owner must apply unique versions and run DB CI after each sequential merge. |
| Privilege / five-slot / privacy invariants | PASS locally / PARTIAL operationally | 18 DB contracts pass in PostgreSQL 16, including five-slot, private-address, consent and release gates. Real approvals and human evidence review remain owner-only. |
| Authenticated staging acceptance | BLOCKED | Four staging specs require a private `TRUSTFIVE_STAGING_ACCEPTANCE` storage state and skip without it. No real customer/professional session, territory or approval was used. |
| Vercel preview | BLOCKED (environment) | All draft PRs show `Vercel: failure` with `Deployment rate limited — retry in 24 hours.` No deployment was attempted from these branches. |
| Supabase preview branches | BLOCKED (configuration) | `Supabase Preview: skipped` on all PRs; branch previews are disabled/not associated. |
| Live production tests / payments | BLOCKED by design | No live database, production merge, Stripe live mode, paid geocoder or professional approval was performed or proposed. |

## Owner actions before any production merge

1. Apply the unique migration versions from PR #43 and rerun database CI after
   each sequential merge.
2. Ensure the merged tree retains PR #35's lint gate and PR #37/#43's Playwright
   file-scope repair.
3. Complete authorised authenticated staging acceptance with real consented
   users; do not count opt-in skips as passes.
4. Retry Vercel after the rate-limit window and enable Supabase preview branches
   if required.
5. Obtain explicit owner sign-off for security, privacy, country release gates
   and any live-money activation.

No production merge is proposed by this challenge.
