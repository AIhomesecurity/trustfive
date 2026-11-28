# Messaging load/retry fixture repair

## Scope

This slice repairs the failing synthetic messaging test on PR #170's exact head
`d0bd5557b7d23faa3c143b19626ab7b727804097`. It does not connect to a hosted
database, deploy, change production data or touch another agent's branch.

## Reproduced failure

At PR #170's exact head, GitHub check `build` failed in the browser-test step:

```
[chromium-loopback] signed-in-messaging-load-retry.spec.ts
Error: expect(locator).toContainText(expected) failed
Expected substring: "Unable to load this conversation"
element(s) not found
```

The same failure reproduced locally with an isolated loopback fixture, a
placeholder publishable key and the committed production Next.js build.

## Root cause

The installed `@supabase/postgrest-js` client enables GET retries by default and
retries HTTP 503 responses. The fixture failed only the first `503` read, so the
client transparently retried it and the page rendered the successful empty
result before the test could observe the explicit error/retry state. The product
code in `app/messages/page.tsx` was correctly setting a distinct load-error
state; the fixture was testing the SDK's automatic recovery instead.

The fixture now emits a non-retryable `500` failure for the initial read, then
succeeds only after the user selects **Refresh messages**.

## Verification

Commands run from the isolated worktree with
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture`:

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npx playwright test --project=chromium-loopback tests/e2e/signed-in-messaging-load-retry.spec.ts --reporter=list` | 1 passed / 0 failed |
| `npx playwright test --reporter=list` | 263 passed / 0 failed / 4 skipped |

The focused fixture also verifies:

- the first failed read shows an alert and no false “No messages yet” state;
- the manual retry clears the alert and renders the empty conversation;
- one send produces exactly one captured insert and one rendered message;
- reloading keeps one message and does not issue a second insert;
- an unrelated signed-in account opening the same quote link sees neither the
  conversation nor the message and never reads the quote's messages.

## Still blocked

- The exact-head external `Workers Builds: trustfive` check failed outside this
  fixture; the local Vinext compile and Worker smoke checks pass in CI.
- `Supabase Preview` remains skipped by the repository integration.
- No hosted staging/production database was used, so no hosted message row was
  created, read or repaired.
