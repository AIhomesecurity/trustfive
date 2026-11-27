# REA Clean-Room Product Teardown: Rated People + Houzz UK → TrustFive

> **Method:** Reverse Engineer Anything (REA) 8-stage clean-room product teardown spine (Snapshot → Users & JTBD → Core Loops → Architecture Primitives → UX Craft → Growth Loops → Structural Vulnerabilities → TrustFive Clean-Room Synthesis). Zero proprietary code or scraping; 100% original clean-room architecture aligned to TrustFive's UK privacy, five-approved-pro cap, fair waiting-list, and payment-independent ranking invariants.

---

## 1. Snapshot

| Dimension | Rated People (UK) | Houzz UK & Houzz Pro | TrustFive Combined Synthesis |
|---|---|---|---|
| **Positioning** | Homeowner job-posting & capped-quote trade marketplace (entered CVL Sept 2026; brand/web acquired by Checkatrade Group) | Visual home-renovation discovery, Ideabooks scrapbooking & Houzz Pro B2B estimating/project software | Verified UK local trade marketplace + LinkedIn/Nextdoor Social + Houzz-style Project Ideabooks + Rated People capped-quote clarity |
| **Core Homeowner Hook** | Free job post, capped quote volume (max 3 quotes, no spam deluge), multi-axis ratings | Room/style inspiration galleries, personal **Ideabooks**, running renovation budgets, Design Dilemma Q&A | Free job brief with **5-approved-pro area cap**, private **Project Ideabooks** with live budget roll-up & 1-click brief conversion, verified showcases & local Q&A |
| **Core Tradesperson Hook** | Controlled competition per job (higher win rate than 10-way bidding) | Visual portfolio showcases + Houzz Pro itemised estimates, milestones & client communications | **£0 per-lead fees**, max 5 independently approved pros per trade & area, **Itemised Quote & Milestone Builder**, HMRC CSV, printable quote sheets, `.ics` calendar & trade-to-trade referral bridge |

---

## 2. Users & Jobs-to-be-Done (JTBD)

- **Homeowner (Planning Phase — Houzz JTBD):** *"Before I invite tradespeople into my home, help me collect real local examples, estimate realistic UK costs across multiple jobs, and keep my renovation budget organised in one place."*
- **Homeowner (Hiring Phase — Rated People JTBD):** *"When I'm ready for quotes, help me explain my property era, urgency, and scope clearly so I receive a small number of tight, comparable written quotes — without 25 strangers ringing my mobile."*
- **Tradesperson (Quoting Phase — Houzz Pro + Rated People JTBD):** *"Show me serious, well-scoped local jobs without charging me £15–£45 just to reply, and give me clean itemised estimating and milestone tools so my written quote wins on professionalism rather than racing to the bottom."*

---

## 3. Core Loops

1. **Inspiration → Ideabook → Job Brief Loop (Houzz → TrustFive):**
   - Browse `/cost-guides` or `/community/social?tab=showcases` (filtered by room/trade) → Save items into a private **Project Ideabook** (`/ideabooks`) → Track running total vs target budget → Click **Turn Ideabook into a Job Brief** → Pre-filled `/jobs` submission routed to up to 5 independently approved local pros.
2. **Structured Brief → Itemised Quote → Confirmed Booking Loop (Rated People + Houzz Pro → TrustFive):**
   - Homeowner adds property era, urgency & access notes via `JobBriefHelper` → Approved local pro opens `/quotes` → Builds transparent Labour / Materials / VAT / Milestone quote via `QuoteItemisedBuilder` → Sends written quote → Homeowner compares and confirms booking with revocable private address consent.

---

## 4. Architecture Primitives Added

- **Database (`supabase/migrations/0057_ideabooks_and_project_planner.sql`):**
  - `public.homeowner_ideabooks`: Strictly owner-private (`auth.uid() = owner_id` RLS across `SELECT/INSERT/UPDATE/DELETE`) project boards with UK room category, UK property style, target budget in pence, status (`planning`, `quoting`, `completed`), and notes.
  - `public.homeowner_ideabook_items`: Strictly owner-private items referencing either a published `completed_work_showcases` row, a `cost_guide_slug`, or a custom scope note with estimated cost in pence.
- **Pure Domain Libraries:**
  - `lib/ideabooks.ts`: Room & UK property style taxonomies, live budget roll-up & over-budget detection, 1-click `/jobs` prefill generator, and safe quick-add query parser.
  - `lib/quote-itemiser.ts`: Line-item estimate engine (Labour, Materials, Access/Equipment), optional 20% UK VAT calculation, UK payment milestone schedules, and formatted written quote scope generator.
- **UI Components & Routes:**
  - `/ideabooks` (`app/ideabooks/page.tsx`): Full Project Ideabooks & Budget Planner.
  - `components/quote-itemised-builder.tsx`: Collapsible Houzz Pro-style itemised quote & milestone builder mounted inside `/quotes`.
  - `components/social-showcases-feed.tsx`: Room/trade filter chips + **Save to Ideabook** button on every published installer showcase.
  - `app/cost-guides/page.tsx`: **Save to Ideabook** action on every trade cost guide card.
  - `components/job-brief-helper.tsx`: UK property era selector + 5-approved-pro quote-cap clarity notice.

---

## 5. Vulnerabilities Avoided (Clean-Room Guardrails)

1. **No Double-Charging (Rated People's Fatal Flaw):** Legacy Rated People charged both membership fees and per-lead fees, triggering high trade churn and its September 2026 insolvency/Checkatrade absorption. TrustFive keeps per-lead fees at **£0** permanently.
2. **No Pay-to-Rank or Pay-to-Approve:** Neither Ideabooks, Showcases, nor Quote Builders can ever purchase directory placement, bypass the 5-pro cap, or alter fair waiting-list order.
3. **Zero Address or Contact Leaks:** Ideabooks are strictly owner-private (`auth.uid() = owner_id` RLS), Showcases & Social remain protected by PostgreSQL `showcase_contact_free` constraints (Migration `0056`), and homeowner addresses stay private until explicit revocable booking consent.
