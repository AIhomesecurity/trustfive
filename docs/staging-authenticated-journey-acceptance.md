# Authenticated staging journey: evidence and safety checklist

Status: **NOT VERIFIED**. This is a reproducible acceptance protocol, not a claim that the flows work. Run only on the isolated staging project `lkfkhjthdtcefrcaatsi`, never against production. Do not create fabricated public businesses, real reviews, or accounts masquerading as genuine customers.

## Preconditions and evidence

1. Record the exact GitHub feature-branch SHA, application and database Actions run URLs, Vercel deployment ID/commit, Supabase project ref and applied migration versions. Confirm that the preview is protected and uses staging-only configuration.
2. Confirm migration parity, security advisories, email/OAuth redirect allowlists, and that test-mode billing cannot create live charges. Never paste credentials, full property addresses or access tokens into tickets or CI logs.
3. Obtain explicitly authorised **isolated test identities** for one customer, one independently vetted approved professional and one unrelated professional. If genuine vetted professionals or verified territory records are absent, **stop the positive-path test and report blocked**; do not grant fake approvals or fabricate listings. Negative-path tests may still run in a disposable local database fixture.
4. Record a redacted evidence matrix with columns: step, actor, expected outcome, observed outcome, timestamp, commit, environment, evidence link and pass/fail/block reason.

## Customer and professional acceptance matrix

| Step | Actor | Expected result / negative assertion |
| --- | --- | --- |
| Registration, confirmation, sign-in and password recovery | Customer and professional | Authenticated session works; invalid and expired links fail safely; no secrets or private address in URL |
| Service + address search | Customer | CCTV/alarms synonyms work; exact property vs postcode centroid precision is labelled truthfully; unsupported territories do not silently select a nearby but incorrect area |
| Publish job | Customer | House/street required for postcode-only input; server enforces verified territory and private job-site storage; no public exact address |
| View lead | Approved in-radius professional | Lead visible only with active vetted allocation in the correct trade/territory and verified radius |
| Attempt lead/quote | Unrelated or unapproved professional | Both visibility and quote creation denied server-side, regardless of modified client request |
| Submit quote | Approved professional | Customer receives only the relevant quote; other professionals cannot access it |
| Accept quote / book | Customer | One valid booking, ownership checks, no accidental duplicate acceptance; notifications scoped to participants |
| Address disclosure default | Booked professional | Exact address unavailable before explicit customer consent |
| Address opt-in and revoke | Customer | Only booked professional can retrieve after opt-in; unrelated professional denied; revocation immediately removes access |
| Completion and review | Participants | Only correctly completed booked work can produce a verified review; unrelated and repeat reviews rejected |
| Community access | Neighbourhood member / outsider | Group-only posts and messages cannot be read by nonmembers; reports and moderation have auditable ownership |

## Exit criteria

Mark the journey verified in issue #12 **only** after actual authenticated staging results, relevant negative RLS tests, passing CI at the tested SHA, and a READY preview at the same SHA. A READY build alone is not browser acceptance. Do not weaken RLS or create fake approved providers to make a demo pass. If blocked, record the exact missing prerequisites and continue independent static/fixture security tests.

## Current known blockers (revalidate each run)

The staging project previously had no independently verified professional service locations or reviewed territories. Protected Vercel preview browsing and real authenticated customer-to-professional tests remain unverified. Supabase security advisor flags restricted RLS-without-policy tables and anonymous SECURITY DEFINER directory functions; review intent and grants individually before changing access.
