# TrustFive engineering checkpoint — 2026-11-20 03:56 UTC

## Independently inspected baseline
- Feature branch HEAD at start: `479d8dc3154237b6a0b2d4721a1766ea550d5b71`; both application and database CI passed for that SHA (runs 44668833356 and 44668833398).
- PR #1 remains the review boundary; issue #12 is the authoritative verified completion tracker. Do not mark authenticated production readiness complete.
- Latest inspected Vercel READY preview for baseline SHA: https://trustfive-gilgsx7vp-trust-five.vercel.app . READY does not verify protected authenticated browser access.
- Supabase staging `lkfkhjthdtcefrcaatsi`: 0 active professionals, 0 verified coverage records, 4 defined service areas. No fabricated records inserted.
- Security advisor: 7 intentionally private RLS/no-policy tables and 4 anonymous-executable SECURITY DEFINER functions; no blanket permission changes. Continue role-by-role review.
- Paid Lovable Trade Finder project `57a5af88-61ad-4722-87f5-59fb156139bb` is READY and separate; free Experience Lab `69558021-69b4-4166-b6be-ea01ba47fdb0` is out of credits. No generation or GitHub sync performed.

## Atomic feature delivered this cycle
- Problem: postcode fallback returns a centroid, not a house. The job form previously saved a postcode-area label as if it were a job-site address, creating an unusable address for a booked tradesperson.
- Fix: when the selected location has `precision='postcode'`, the customer must provide a private house number/name and street. The saved address combines those details with the postcode label; coordinate precision **remains postcode** and the UI explicitly explains that the coordinates are approximate. Property-level autocomplete continues to use the selected verified address.
- Validation: private formatter rejects missing/short property lines and overlong combined addresses, consistent with the 250-character database limit. Regression tests exercise both precision paths without creating user or business data.
- Commits: `b8431b7` (form), `f8665bb` (formatter), `721694e` (form integration), `2e45e27` (regression test).
- CI for newest commit was not yet complete at this checkpoint; do not claim green.

## Updated priority backlog
1. **P0** Confirm application and database CI green for the postcode-address changes; repair any failures.
2. **P0** Validate real authenticated customer job posting, private location retrieval, eligible quote, booking and consent disclosure with authorised test accounts in staging. Never create fake real listings.
3. **P0** Resolve property-level address provider and postcode-centroid ambiguity with a verified property-address provider; do not claim postcode coordinates are premises-level.
4. **P0** Obtain independently reviewed service territory boundaries and professional service radii before enabling meaningful real-world proximity results.
5. **P0** Targeted SECURITY DEFINER function/RLS ACL tests, preserving helpers required by public business-page RLS.
6. **P1** Complete responsive professional business centre, verified review flows, neighbourhood feed/groups/events/messaging accessibility and error recovery.
7. **P1** Inspect paid Lovable source diff for independently useful original design components and port only after review and tests; no direct sync.
8. **P2** Worldwide address providers, native mobile packaging, test-mode payment journeys, operational monitoring.

No production merges, domains, paid credits, live payments or irreversible operations.
