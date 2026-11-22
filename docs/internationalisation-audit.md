# TrustFive Internationalisation & Money Safety Audit

- **Audit date:** 2026-11-21
- **Base branch audited:** `feature/verified-marketplace-core` (`a78611e`)
- **Work branch:** `agent/agy-international-readiness`
- **Scope discipline:** Respects parallel ownership boundaries (OpenCode integration, ChatGPT TrustFive Social/auth, and unmerged Draft PRs `#32`, `#36`, `#40`). Safely refactors shared library foundations now and documents exact coordinated patches for agent-owned pages.

---

## 1. Executive Summary

TrustFive's core UK marketplace currently assumes GBP (`£`), `en-GB` date formatting, `Europe/London` timezones, and UK postcode lookups (`postcodes.io` / `countrycode:gb`) across multiple pages and API routes. Several pages also perform floating-point arithmetic (`amount_pence / 100` or `Math.round(Number(amount) * 100)`) that is unsafe for large amounts, zero-decimal currencies (`JPY`), or three-decimal currencies (`KWD`, `BHD`, `OMR`, `JOD`).

This PR establishes the foundational international architecture **without** fabricating live international coverage, **without** inventing exchange rates, and **without** weakening existing UK country-release or five-slot database gates:

1. **Country & Regional Configuration (`lib/international/countries.ts`)** — Strongly typed configuration for 8 display markets (`GB`, `US`, `IE`, `AU`, `CA`, `NZ`, `IN`, `JP`) explicitly separating display formatting, registration/interest availability, address-lookup capability, and authoritative 6-approval database release gates (`evaluateCountryOperationalStatus`).
2. **Exact-Integer ISO 4217 Money Library (`lib/international/money.ts`)** — `BigInt`-backed exact minor-unit parsing, arithmetic, comparison, and `Intl.NumberFormat` rendering supporting 0-decimal (`JPY`), 2-decimal (`GBP`, `USD`, `EUR`, `AUD`, `CAD`, `NZD`, `INR`), and 3-decimal (`KWD`, `BHD`, `OMR`, `JOD`) currencies with strict `MoneyCurrencyMismatchError` enforcement.
3. **Truthful Regional Preferences (`app/preferences/regional/page.tsx` + `supabase/migrations/0038_user_regional_display_preferences.sql`)** — Accessible display settings that distinguish `Browser session only` from `Saved to your TrustFive account`, keep legacy UK quotes fixed in `GBP`, validate IANA timezones in PostgreSQL, and never unlock unapproved countries.
4. **Backwards-Compatible Budget Parsing (`lib/job-budget.ts`)** — Refactored `parseJobBudgetPence()` onto `parseMoneyInput(input, 'GBP', ...)` with zero breaking changes.

---

## 2. Categorised Findings Across the Codebase

### Category A — Hardcoded `£`, `GBP`, and Floating-Point Money Math

| File & Line(s) | Current Pattern | Risk | Status / Recommended Action |
| --- | --- | --- | --- |
| `lib/job-budget.ts` | Previously used manual string splitting dedicated only to GBP | Duplicated parsing logic | **Fixed in this PR:** now delegates to `parseMoneyInput(input, 'GBP', ...)` while preserving exact legacy error messages and GBP bounds. |
| `app/quotes/page.tsx:12,74-75` | `const pence = Math.round(Number(amount) * 100)` and `const money = (pence) => '£' + (pence / 100).toFixed(2)` | **High:** IEEE-754 floating-point drift on decimal inputs and breaks for 0-decimal/3-decimal currencies. | **Coordinated follow-on (post-PR #32/#40 merge):** replace line 74 with `parseMoneyInput(amount, 'GBP', { minMinorUnits: 100, maxMinorUnits: 1_000_000_000 })` and line 12 with `formatMoney(fromLegacyGbpPence(pence), displayLocale)`. |
| `app/jobs/page.tsx:119-123` | `£{(q.amount_pence / 100).toFixed(2)}` | Hardcoded `£` and division by `100` | **Coordinated follow-on (post-PR #32/#40 merge):** render via `formatMoney(fromLegacyGbpPence(q.amount_pence), displayLocale)`. Keep currency strictly `GBP` until DB schema gains an explicit `currency_code` column. |
| `app/messages/page.tsx:133,142` | `£{(t.amount_pence / 100).toFixed(2)}` | Hardcoded `£` and division by `100` | **Coordinated follow-on (post-PR #36 merge):** render via `formatMoney(fromLegacyGbpPence(t.amount_pence), displayLocale)`. |
| `app/dashboard/page.tsx:8,62` | Selects `budget_pence` as untagged integer | Implicit GBP assumption | **Coordinated follow-on:** tag with `fromLegacyGbpPence()` when formatting; never reinterpret `budget_pence` as another currency. |
| `app/billing/page.tsx:46,54`, `app/professional/business/page.tsx:85`, `app/api/billing/checkout/route.ts:37-39` | Hardcoded `£19.99 per month`, `price.currency !== 'gbp'`, `price.unit_amount !== 1999` | Intentional UK MVP Stripe guardrail | **Owner / regulatory-gated:** keep UK GBP £19.99 guardrail enforced until multi-country Stripe accounts, tax/VAT rules, and regional membership pricing are formally approved by the business owner. |

### Category B — Hardcoded `en-GB` Locale & `Europe/London` Timezone

| File & Line(s) | Current Pattern | Risk | Status / Recommended Action |
| --- | --- | --- | --- |
| `app/schedule/page.tsx:12,75,86` | `useState('Europe/London')` and `.toLocaleString('en-GB')` without passing stored timezone | **Medium:** appointment timestamps can appear in browser-local timezone instead of appointment/user timezone across DST shifts. | **Coordinated follow-on (PR #36 already improves `/schedule`):** unify on `formatLocalizedDateTime(iso, pref.displayLocale, appointmentZone)` and initialise default zone from `readSessionRegionalPreference().displayTimeZone`. |
| `app/dashboard/page.tsx:41`, `app/coverage/page.tsx:113`, `app/notifications/page.tsx:51`, `app/messages/page.tsx:149`, `app/bookings/page.tsx:95`, `app/jobs/page.tsx:119` | `.toLocaleString('en-GB')` / `.toLocaleDateString('en-GB')` | Always formats dates in British format regardless of user preference | **Coordinated follow-on:** adopt `formatLocalizedDate()` / `formatLocalizedDateTime()` from `lib/international/countries.ts`. |
| `app/community/events/page.tsx:99-100`, `app/community/groups/page.tsx:123`, `app/community/page.tsx:57` | `.toLocaleString('en-GB')` | ChatGPT-owned TrustFive Social area | **Do not modify here:** hand off `formatLocalizedDateTime()` helper to TrustFive Social owner when ready. |
| `app/admin/readiness/page.tsx:59`, `app/admin/page.tsx:53,75` | `.toLocaleString('en-GB')` | Admin internal console | **Low priority:** safe for UK admin team; can optionally adopt user display locale later. |

### Category C — UK-Only Postcode & Address Assumptions

| File & Line(s) | Current Pattern | Risk | Status / Recommended Action |
| --- | --- | --- | --- |
| `app/api/address/search/route.ts:8-54` | Queries `https://api.postcodes.io` and passes `filter=countrycode:gb` to Geoapify | UK-only lookup | **Keep UK-scoped until non-UK countries pass release gates.** When an international country is approved, route by country config (`COUNTRY_CONFIGS[code].addressLookupSupport`) and never silently fall back to UK postcodes for non-UK entries. |
| `lib/uk-postcode-lookup.ts`, `lib/job-address.ts:16`, `components/address-search.tsx:46` | UK postcode validation & copy (`England, Scotland, Wales and Northern Ireland`) | Accurate for current UK-only operation | **Keep truthful for UK today.** Future non-UK address capture should use `COUNTRY_CONFIGS[code].postalCodeLabel` (`ZIP code`, `Eircode`, `Postal code`, `PIN code`) and manual entry until country-specific geocoding is vetted. |

### Category D — Country Release Copy & Operational Governance

| File & Line(s) | Current Pattern | Risk | Status / Recommended Action |
| --- | --- | --- | --- |
| `supabase/migrations/0029_verified_country_coverage_status.sql` & `0033_country_release_signoff_gates.sql` | Authoritative DB release gate (`country_release_signoffs`, `trustfive_admin_country_release_gate`, 6 independent human sign-offs) | Strong existing protection | **Preserved 100% intact.** `evaluateCountryOperationalStatus()` mirrors and reinforces these gates in TypeScript and fails closed whenever any sign-off or explicit owner activation is missing. |
| `app/coverage/page.tsx:80-85` | Accurately frames UK coverage search and pending area requests | Truthful today | **No change required in this PR.** Keep `/coverage` strictly tied to UK verified territories and pending interest requests. |

---

## 3. Database Schema Roadmap (For Future Multi-Currency Launch — Not Applied Prematurely)

Before any non-GBP marketplace country opens for live bookings, a future migration (coordinated with the database owner and Stripe rollout) should:

1. Add an explicit `currency_code text not null default 'GBP'` column with ISO 4217 CHECK constraint to `jobs` and `job_quotes` alongside `budget_minor_units` / `amount_minor_units` (keeping legacy `budget_pence` / `amount_pence` strictly tagged as `GBP` during transition).
2. Enforce at the database trigger/constraint level that a `job_quote.currency_code` MUST equal its parent `job.currency_code` (preventing cross-currency quotes at rest, matching `MoneyCurrencyMismatchError` in application code).
3. Record an authoritative, immutable currency snapshot on `bookings` and `membership_subscriptions` rather than ever applying display-time FX conversions.
4. Keep `user_regional_preferences` strictly scoped to **display formatting** — never join it into quote pricing, territory eligibility, or five-slot allocation logic.
