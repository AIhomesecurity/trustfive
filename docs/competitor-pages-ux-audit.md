# TrustFive competitor page and experience audit — 19 November 2026

## Method and limits
Reviewed publicly available product and help pages from Checkatrade, TrustATrader, MyBuilder, Taskrabbit, Nextdoor and Meta/Facebook, including public screenshots. This is a **functional/UX pattern audit**, not access to private source code, user data, authenticated screens or proprietary design files. Do not claim that any competitor feature has been cloned; implement original components and services and verify each before marking complete.

## Observed patterns and original TrustFive interpretation
| Reference | Public pattern observed | TrustFive implementation direction |
|---|---|---|
| Checkatrade | Task-led trade search, popular trade shortcuts, separate homeowner and trade journeys, reviews, job estimator | Focused search above fold, popular quick links, category grid, explain verification, saved job workflow |
| MyBuilder | Ask 'what is your job?', guided posting, tradesperson profiles, matching and quotes | Search or post a job from first screen; progressive job questions; compare up to five qualified local profiles |
| TrustATrader | Trade taxonomy and location search, vetted listing profiles, limited memberships in areas | Transparent five-place capacity, independent assessments, area membership, fair waiting lists |
| Taskrabbit | Service-first entry, guided booking, task descriptions and availability | Fixed-price/short tasks alongside quote-based project bookings; calendar and messaging |
| Nextdoor | Neighbourhood recommendations, business pages and local posts | Local feed, recommendations leading to verified profiles, groups and local events |
| Facebook/Meta | Multiple user surfaces: social profiles, pages, groups, events, posts and marketplace | Original neighbourhood/community navigation, business pages, moderation, local listings |

## Concrete page map and acceptance criteria
| Page / flow | Priority | Acceptance gate |
|---|---|---|
| / (discovery homepage) | P0 | Clear search and job CTA; 16 categories in balanced rows; small screens usable; no empty leftover grid row |
| /services (search) | P0 | Trade links preselect actual database categories; optional area filter; show honest zero-result state |
| /jobs (customer requests) | P0 | Authenticated customer submits valid job; ownership and RLS checked; persistent result |
| /business/[id] (professional profile) | P0 | Only approved, active professional pages published; genuine review totals; contact path |
| /professional/apply (professional intake) | P0 | Verification application, documents, status, area/trade choice; admin review required |
| /quotes, /bookings, /messages | P0 | Enforced participants, acceptance, confirmations and realistic states end-to-end |
| /account, /dashboard | P0 | Login, signup, redirects and session flows verified in real browser |
| /community | P1 | Posts/reactions, groups, events and reporting; privacy and moderation |
| /notifications, /schedule | P1 | Notifications and appointment confirmation tied to real records |
| /billing | P2 | Stripe test only, webhook validation, reconciliation, never connected to ranking |
| Local classified listings | P2 | Separate listing data/permission model and abuse reporting |
| Media/video/feeds and mobile apps | P3 | Secure uploads, consent, moderation, performance and accessibility |

## Design system rules
- Original TrustFive colours, logo, writing and components: do not copy competitors' distinctive visuals, illustrations, copy or design assets.
- Use semantic search, descriptive category names, consistent fixed-column grids, sensible row counts and responsive 2-column phone category cards.
- Follow actual workflows: category → filtered professional directory; query → relevant search or understandable fallback; job post → persistent request and match.
- No fake professional profiles, ratings, endorsements, booked appointments or reviews.
- Confirm the five-place rule and review/publication permissions in PostgreSQL, not UI code.
- Accessibility: keyboard focus, labels, correct landmark elements, screen-reader hints and reduced motion.
- Test at approximately 360, 390, 768, 1024 and 1440px and check no orphan rows, horizontal overflow or clipped buttons.

## Public reference pages used
- https://www.checkatrade.com/
- https://www.checkatrade.com/support/consumer/jobs/how-to-find-a-trade
- https://www.mybuilder.com/
- https://www.mybuilder.com/how-it-works
- https://www.trustatrader.com/trades
- https://www.trustatrader.com/
- https://www.taskrabbit.co.uk/
- https://blog.nextdoor.co.uk/2019/07/09/introducing-nextdoors-local-business-pages-and-recommendations
- https://developers.facebook.com/docs/content-library-and-api/

## Work completed in this tranche
- Redesigned homepage category grid, search, shortcuts and three-stage explanation.
- Trade/category links now reference actual Supabase trade slugs; directory reads URL query and preselects a category.
- Follow-on work: run responsive browser screenshots, test signup/job journeys, then build category landing pages with SEO and local area discovery.

Do not mark the complete competitor feature inventory implemented merely because this audit exists.


## 21 November 2026 — quality-lane release gates (evidence-based follow-up)

This section adds acceptance criteria, not claims of implemented features. The protected staging deployment for commit `be03184d94dcb097f350f64c4ddd798dfd26d3c5` was reported READY by Vercel, and its GitHub application and database workflows both concluded success (runs 44902867270 and 44902867274). READY and green CI **do not** establish authenticated customer acceptance or prove real vetted participants exist.

| Priority | Gap / original TrustFive UX outcome | Testable acceptance | Dependencies and safety risks |
|---|---|---|---|
| P0 | Customer search-to-booking journey: MyBuilder/Rated People-style guided request and Taskrabbit-style clear appointment status, without copying interface assets | In protected staging, authorised customer signs up, selects exact property and trade, posts job, receives quote only from a separately approved eligible professional, accepts it, confirms appointment, completes booking and submits a review linked to that booking; verify reload, auth redirect and cancellation; zero providers yields truthful empty state rather than fake profiles | Needs consented real pilot participants or explicitly isolated, clearly labelled and removable test fixtures; never auto-approve providers or expose private job addresses |
| P0 | Five-slot and fair-waitlist trust: TrustATrader/Checkatrade-inspired vetting disclosure, with TrustFive's independent allocation rule | Concurrent sixth activation is rejected in database; only five independently reviewed active professionals appear per trade/area; waiting-list offers obey documented eligibility/order and expiry; payment never changes selection or ranking; customer sees accurate verification and review provenance | Security lane owns RLS/SQL and concurrency tests; avoid competing migration edits; serious complaint or appeal must receive human review |
| P0 | Private-address and permissions audit | Anonymous and unrelated users cannot retrieve private property coordinates or booking consent; revocation takes effect immediately; privileged functions have individual documented grants and negative tests | Supabase advisor on 21 Nov reported seven RLS-enabled/no-policy tables and four anonymous SECURITY DEFINER functions. These are warnings to investigate, not permission to add broad SELECT policies or revoke intentionally public search RPCs blindly |
| P1 | Accessible mobile search and neighbourhood trust | Keyboard and screen-reader users can disambiguate addresses; 360/390/768px journeys have no overflow; posts/groups/events support accessible reporting, moderation status, membership privacy and appeal; user-generated media never leaks exact addresses | Requires authentic moderation roles, abuse/rate-limit controls, content retention policy and mobile browser testing |
| P1 | Rated People-style job progress transparency, adapted originally | Customer sees job submitted, interested, quoted, booked, completed and reviewed states based only on authoritative database records; professional cannot bypass eligibility; expired offers and zero matches have clear recovery actions | Coordinate main booking lane and UX lane; never represent pending, declined or synthetic quotes as completed |

**Evidence and follow-up:** [application CI](https://github.com/AIhomesecurity/trustfive/actions/runs/44902867270), [database CI](https://github.com/AIhomesecurity/trustfive/actions/runs/44902867274), [Supabase RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Supabase SECURITY DEFINER advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [Rated People public site](https://www.ratedpeople.com/). Authenticated staging acceptance remains unverified. No protected competitor content or private customer data was used.


## 21 November 2026 — 15:41 UTC independent release-risk checkpoint

Source of truth: PR #1 head `a439b01992aeb2f8f55238c5bca4f7c490d2f310`; GitHub Actions application run 44919515079 and database run 44919515077 both completed successfully on that exact SHA. Vercel's most recently returned READY deployment is `03e9a6c8853fe1c23db0f6fd33cc0100d381bbd9`, **not** the inspected HEAD; a READY build is not authenticated acceptance. Supabase health advisor returned no notices. Supabase security advisor returned nine RLS-enabled/no-policy tables, four anonymously executable SECURITY DEFINER functions and 41 authenticated-role callable SECURITY DEFINER functions. Advisor notices require per-function access review and do not alone establish a vulnerability; intentionally private RLS tables may correctly have no public policies.

### P0 independent acceptance gaps and safe evidence requirements

1. **Release decisions and vetting integrity.** With no verified human sign-offs or real independently vetted participants, release readiness must remain blocked. Acceptance: human reviewer evidence and actor/time audit trail exist for each country/territory and professional; submitted evidence never implies approval; revoked/expired approval cannot appear in public results; release cannot be self-approved by a customer/professional. Dependencies: admin review UI, restricted signoff RPC, genuine reviewers, staging identities. Risks: impersonated approval, false trust badges, accidental publication. Coordinate with issue #19 and admin lane; do not duplicate its code.
2. **Privilege and private-data audit.** Acceptance: classify each of the nine no-policy tables as intentionally inaccessible or requiring a narrow policy, verify anon/authenticated EXECUTE grants for each privileged RPC, and run negative role-based tests for private job locations, consent events, webhook records, approvals and waitlist ordering. Public directory RPCs may intentionally be anonymous only if their outputs are independently reviewed as safe. Dependencies: security lane PRs and database contracts. Risks: broad grants leaking addresses or allowing unauthorised allocation; never add permissive policies merely to clear advisor warnings.
3. **Signed-in customer journey and mobile fallback.** Acceptance: permitted existing staging customer posts a valid exact-address job without leaking street data in URLs, eligible independently approved professional alone may quote, both parties confirm booking, genuine completed booking alone can be reviewed, and zero-professional or revoked-consent states explain why no action is available; test keyboard and 360px viewport. Dependencies: vetted staging participants, reviewed territories, identity-backed staging test harness. Risks: privacy leaks, fabricated reviews, mistaken availability; do not fabricate professional approvals to make the test green.

The OpenCode issue #19 was still queued when inspected; its last recorded provider quota was exhausted, not proof of code generation. This checkpoint is documentation/evidence only, not a passed staging test or a source-code security fix.
