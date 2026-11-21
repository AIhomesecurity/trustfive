# Cross-account staging acceptance — authorised people and actual records

**Status: NOT YET VERIFIED.** These new tests are a reproducible *read-only* check, not evidence that a test ran successfully. The regular pull-request CI intentionally does not execute `tests/staging/`, because that requires authorised staging identities and real, independently reviewed professional coverage.

## Prerequisites

An authorised staging reviewer must provide all of the following **through an ephemeral secret channel**, not in GitHub comments, shell histories or screenshots:

- `TRUSTFIVE_STAGING_BASE_URL`: the correct HTTPS Vercel preview for the exact tested development SHA, with Supabase staging project `lkfkhjthdtcefrcaatsi`, **never a public production URL**.
- `TRUSTFIVE_STAGING_CUSTOMER_EMAIL` and `TRUSTFIVE_STAGING_CUSTOMER_PASSWORD`: an explicitly consenting test participant who owns **neither** of the records described below.
- `TRUSTFIVE_STAGING_PRO_EMAIL` and `TRUSTFIVE_STAGING_PRO_PASSWORD`: a distinct, explicitly consenting authorised participant who **alone** owns the quote and booking below. No synthetic approval of an otherwise unvetted professional.
- `TRUSTFIVE_STAGING_OTHER_QUOTE_ID` and `TRUSTFIVE_STAGING_OTHER_BOOKING_ID`: UUIDs of *existing* real staging records, owned only by the second participant. They must not belong to the customer, even as one of multiple participants. Do not supply random/non-existent IDs; those only test unknown-record denial, not cross-account isolation.

The route test uses the customer identity to request each other's actual quote and booking. It checks that no conversation is selected, no message bubble renders and the booking entry does not appear. The browser test does **not** change permission, grant address consent, create jobs, seed organisations, or move money.

Run with:

```bash
npx playwright test --config=playwright.staging.config.ts tests/staging/cross-account-privacy.spec.ts
```

Supply the six environment variables via a protected environment/secure secret injector before running. Neither the test source nor public GitHub issues should contain those values. The configuration disables traces, screenshots and video; prefer terminal logs redacted of session URLs and all private identities.

**A skipped test is BLOCKED, not PASS.** It is expected to skip when complete authorised credentials or exclusive ownership evidence have not been supplied. If there are no real vetted professionals and no real bookings, retain BLOCKED and focus on isolated synthetic database fixtures in the local disposable CI database instead.

## Acceptance evidence

Record only: date and time, preview SHA, Supabase project ref, identity permissions verified by the reviewer, test name, PASS/FAIL/SKIP, number of tests, CI/build results, and a redacted evidence link. Do not include emails, passwords, private addresses, customer names, record UUIDs or screenshots of private data. Re-run on the same deployed commit after any privacy fix.

This is one slice of a larger release contract: valid quote/booking rejection alone does not certify consent opt-in/revocation, end-to-end booking, territory sourcing, legal/privacy sign-off, or live payments. See `docs/staging-authenticated-journey-acceptance.md` and GitHub issues #12 and #19.
