# Synthetic marketplace onboarding and journey rehearsal

## Scope

This slice adds one isolated loopback rehearsal on the release-candidate base
`480b9324f53cd8b46e234f476025bb61d98533a1`. It does not connect to hosted
Supabase, Vercel or Stripe, and it creates no real professional, customer, job,
quote, booking or payment.

## What the rehearsal proves

The new Playwright spec `marketplace-onboarding-journey-rehearsal.spec.ts` uses
synthetic identities and an HTTP fixture on `127.0.0.1:54321`:

- an onboarding read outage shows an explicit error, and no privileged state is
  rendered before the user selects **Retry loading onboarding**;
- a rejected application is labelled **Not approved** and never appears as an
  active place;
- a verified applicant with 5/5 active places is labelled as waiting list, and
  the page states that payment cannot change queue position;
- one active five-slot place remains one active place after a vacancy offer is
  accepted: final activation is still explicitly pending;
- a rejected low-price quote never ranks above an available quote and cannot be
  accepted;
- cancelling an open job fails once, preserves the confirmation draft, and
  succeeds only on the explicit retry; cancelled jobs do not offer acceptance;
- reopening fails once and succeeds on retry;
- quote acceptance fails once and succeeds on retry, producing exactly one
  booking and the explicit statement that no payment was taken.

## Commands and results

Run from the isolated worktree with
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture`:

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS (one unrelated npm engine warning for `cf@1.0.0-rc.2`) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npx playwright test --project=chromium-loopback tests/e2e/marketplace-onboarding-journey-rehearsal.spec.ts --reporter=list` | 1 passed / 0 failed |
| `npx playwright test --reporter=list` | 263 passed / 0 failed / 4 skipped |

`playwright.config.ts` adds the new spec to the serial `chromium-loopback`
project because, like the existing journey specs, it owns the fixture port.

## Blockers

- Hosted staging verification remains dependent on Release Integration
  confirming an isolated database and on external Workers/Supabase preview
  checks; neither was used for this rehearsal.
- No migration was changed, so there is no migration coordination required for
  this slice.
- No live payment, deployment, production merge or shared database write was
  performed.
