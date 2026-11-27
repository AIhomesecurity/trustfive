# TrustFive 8-Platform Super-App Feature Coverage Blueprint

Maps every core capability from **Facebook, Nextdoor, LinkedIn, Xing, Checkatrade, Rated People, Bark, TaskRabbit, and Houzz** onto TrustFive's privacy-first, 5-approved-pro-cap architecture.

| Super-App Layer | Source Platforms | TrustFive Implementation Status |
|---|---|---|
| **Dual-Mode Profile (Headline, Bio, Skills, Xing Haves & Wants, Completeness Meter)** | LinkedIn, Xing, Facebook | **BUILT & LIVE** (`0058` `social_member_profiles`, `/community/social?tab=network`, Left Profile Rail) |
| **Peer Connections with Personal Note & Skill Endorsements** | LinkedIn, Xing, Facebook | **BUILT & LIVE** (`0058` `social_connections` & `social_skill_endorsements` — no self-endorsements, contact-free) |
| **3-Column Social Feed, Reactions, Comments, Saves, Drafts & Anti-Bypass Firewall** | LinkedIn, Nextdoor, Facebook | **BUILT & LIVE** (`/community/social`, `0056` `showcase_contact_free` DB constraints + UI hard block) |
| **Interactive Neighbourhood & Trade Polls** | LinkedIn, Nextdoor, Facebook | **BUILT & LIVE** (`0058` `social_polls` & `social_poll_votes` with 1-vote-per-member DB uniqueness) |
| **Curated UK Home & Trade Advisories ("Insider / News")** | LinkedIn News, Xing Insider, Houzz Stories | **BUILT & LIVE** (`lib/curated-uk-guides.ts` + 1-click "Discuss in your neighbourhood") |
| **Local Exchange ("For Sale & Free" / Surplus Tools & Materials)** | Nextdoor, Facebook Marketplace | **BUILT & LIVE** (`0058` `social_local_listings` — contact-free, Free/Available/Reserved/Sold status) |
| **Groups, Events (.ics Reminders), Advice Q&A & Moderation Queues** | Facebook, Nextdoor, LinkedIn | **BUILT & LIVE** (`/community/groups`, `/community/events`, `/community/social?tab=advice`, `/admin`) |
| **Installer Work Showcases & Private Project Ideabooks + Budget Planner** | Houzz, LinkedIn Portfolios, Checkatrade | **BUILT & LIVE** (`/community/social?tab=showcases`, `0057` `/ideabooks` with 1-click `/jobs` prefill) |
| **Vetted 5-Slot Directory, Fair Waiting List & Payment-Independent Ranking** | Checkatrade, TrustATrader, Which?, Rated People | **BUILT & LIVE** (DB-enforced max 5 pros/trade/area, 6-stage vetting charter, `0038`) |
| **Guided Job Briefs, 20-Trade UK Cost Guides, Itemised VAT Quotes & HMRC CSV** | Bark, Rated People, Houzz Pro, TaskRabbit | **BUILT & LIVE** (`/cost-guides`, `/jobs`, `/quotes` `QuoteItemisedBuilder`, `/schedule` `.ics`) |
| **Trade-to-Trade Referral & Job-Swap Bridge** | LinkedIn Referrals + UK Trades | **BUILT & LIVE** (`0056` `social_trade_referrals` in `pilot_ledger_only` mode + `/jobs?ref=TF-...` disclosure) |
| **Real-Time Push (FCM/APNs), Transactional Email/SMS & EXIF Media Bucket** | Facebook, Nextdoor, TaskRabbit | **POST-PILOT INFRA** (requires owner SMTP/FCM/R2 storage provider provisioning) |
| **Live Video / WebRTC Calls & Stripe Connect Automated Escrow/Payouts** | Facebook, TaskRabbit, Stripe Connect | **POST-PILOT / REGULATED** (requires UK FCA PSRs 2017, VAT & Stripe Connect commercial sign-off) |
