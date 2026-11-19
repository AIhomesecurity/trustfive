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
