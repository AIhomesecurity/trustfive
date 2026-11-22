# OpenCode browser-test reliability fix

Branch: `agent/opencode-browser-reliability`, from
`feature/verified-marketplace-core` @ `7418e10`. Draft PR only; no merge.

## Reproducible instability

`tests/e2e/uk-coverage-release-gates.spec.ts:9` intermittently failed in CI and
locally because `app/coverage/page.tsx` rendered the anonymous sign-in link only
when `!loading && !signedIn`. The `loading` flag stays true until
`supabaseBrowser().auth.getUser()` and the `trades` query both settle. When the
configured Supabase URL is unreachable or slow, the link never appears within
Playwright's 5-second default timeout. The failure was environment-dependent,
so CI retries could mask it rather than prove deterministic behaviour.

Reproduce on the unmodified base:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='https://placeholder.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='placeholder-public-key'
npm ci --no-audit --no-fund
npm run build
npx playwright test tests/e2e/uk-coverage-release-gates.spec.ts --reporter=line
```

Expected before the fix: `1 failed`, with
`getByRole('link',{name:/go to your account/i})` timing out.

## Fix

Render the static anonymous sign-in copy whenever the session is not known to be
signed in, independent of the auth request. The register button remains disabled
while loading or anonymous, so no action becomes available earlier. This does
not change approval, payment, privacy or ranking logic.

## Deterministic regression coverage

`tests/e2e/coverage-anonymous-boundary-hermetic.spec.ts` delays the stubbed
`rest/v1/trades` response by 3 seconds and asserts within 1 second that the
sign-in link href and privacy copy are present and the submit button is
disabled. Both Supabase calls are stubbed, so no live service or retry is used.
The old condition fails this test deterministically: the link is still hidden
after the 1-second deadline. (`getUser()` short-circuits when there is no stored
session, so delaying auth alone does not reproduce the problem — the `trades`
request is what holds `loading` open.) Verified by running the new spec against
the unmodified build: `1 failed`; after the fix: `1 passed`.

No test was disabled, skipped or given a longer retry.
