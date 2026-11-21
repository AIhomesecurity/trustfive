# Mega milestone 2 — customer journey, security, mobile and reliability

Base: `feature/verified-marketplace-core` @ `995f9d0b3c3d477d36c2e5ba0ab899170082c1d4`. This branch does not include or modify draft PR #26.

## Implementation changes

- `app/account/reset/page.tsx`: password-recovery submission now uses a `useRef` in-flight guard in addition to the disabled button. Two activation events in the same tick can no longer issue two recovery requests.
- `app/globals.css`: global `prefers-reduced-motion: reduce` block disables smooth scrolling, transitions and animations for visitors who request reduced motion. Previously only dashboard elements were covered, while the base stylesheet forced smooth scrolling globally.
- `lib/auth-return-path.ts`: return hints containing nested navigation parameters (`next`, `redirect`, `redirect_to`, `return_to`, `returnTo`, `url`, `to`) are now rejected. This closes a two-hop open-redirect path where a valid `/jobs?...` hint could carry an external target for a downstream screen. Existing legitimate journey hints (`trade`, `area`, `quote`, `booking`) are unchanged.
- `tests/e2e/professional-quotes-anonymous-boundary.spec.ts`: moved worker-scoped `trace`/`screenshot`/`video` options from `describe`-scope to file scope. The previous arrangement aborted Playwright collection for the **entire** suite at the latest integration base, meaning no tests ran at all in CI.

## New tests (26)

- `tests/e2e/customer-mobile-accessibility.spec.ts` (9): no horizontal overflow on `/`, `/services?trade=plumbing`, `/coverage` and `/account` at 320, 360, 390, 768, 1024 and 1440px; keyboard focus indicator; reduced-motion computed style; programmatic labels on search and reset forms.
- `tests/e2e/customer-reliability-boundaries.spec.ts` (5): duplicate recovery submission produces one request; catalogue outage produces an honest failure notice, disabled registration and no fabricated trade options; invalid session cookie cannot reach `/jobs`; address-provider outage leaves no selected location; refresh preserves the anonymous return hint.
- `tests/e2e/customer-security-boundaries.spec.ts` (12): extended return-path adversarial cases; tampered `next` renders no external link; anonymous access to eight protected routes at 320px redirects with an exact return hint; quoted lead IDs expose no conversation; private address text never appears in a public search URL.

All network responses in these tests are stubbed locally. No live Supabase project, real customer identity or fabricated provider listing is used.

## Verification

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Focused new suites | 26 passed / 0 failed |
| Full Playwright suite | 126 passed / 1 failed / 4 skipped |
| ESLint (using the config from milestone 1) | No messages in changed or new files; 15 pre-existing base messages remain and are fixed in PR #35 |

The single full-suite failure is the pre-existing environment-dependent `tests/e2e/uk-coverage-release-gates.spec.ts:4` case, which needs a configured Supabase auth/coverage state. Before the collection fix, the suite aborted with zero tests run; after the fix it executes normally. No new regression.

## Scope notes

No SQL, RLS, approval, waiting-list, payment, booking or quotation implementation was changed. PR #32 (bookings/quotes) was not touched. Tests that would require a real authenticated professional/customer or live approved data are explicitly out of scope locally and remain owner-side staging acceptance items.
