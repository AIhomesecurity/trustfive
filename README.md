# TrustFive.co.uk

An original, UK-first marketplace and neighbourhood community platform, designed for future worldwide expansion.

## Development status

This is **a development foundation, not a production-ready or deployed business**. The current Next.js app includes customer/professional registration, profile editing, job requests, searchable approved professionals, trade-area applications, vacancy responses, neighbourhood posts and comments, reporting, and a database allocation engine. Features are only functional after installing dependencies, configuring Supabase and applying migrations. Authentication providers, live verification, CI validation, real payments, mobile apps and production operations are not yet complete.

## Setup

1. Install Node.js 22; run `npm install`.
2. Copy `.env.example` to `.env.local` and insert the Supabase *publishable* key. Never commit passwords, secret keys or service-role keys.
3. Review/apply `supabase/migrations/0001_core.sql`, `0002_verified_network.sql`, `0003_community.sql`, `0004_quotes_bookings_messages.sql`, `0005_complaints_appeals.sql` in that order through your Supabase SQL editor.
4. Configure Supabase Auth site URL (`http://localhost:3000`) and callback redirect (`http://localhost:3000/auth/callback`). Configure Google/Apple credentials in their respective provider consoles before enabling OAuth.
5. Run `npm run dev` and test independently using at least two user accounts.

## Admin access

Admin rights cannot be granted from the signup form. Once you have verified the administrator's account identity, a database owner must deliberately execute:

```sql
insert into public.platform_admins(user_id)
values ('REPLACE_WITH_VERIFIED_ADMIN_USER_UUID');
```

The approval functions require admin authorization. Do not set `verification_state='verified'` unless actual identification, qualifications, licences and insurance documents have been checked outside the app. The code does not yet include secure document collection, expiry checks, dispute resolution or appeals.

## Core selection rule

Exactly *up to* five slots exist per trade-area pair, enforced by a unique trade/area/slot constraint, with a maximum of five. Qualified applicants enter an independent score-based queue; earlier applications win score ties. Admin-reviewed compliance and score (not payment) determine eligibility. Selected applicants must accept a vacancy offer before activation. A reviewed adverse incident requires evidence and fair human oversight.

## Roadmap

Security review, automated tests, secure proof-of-qualification uploads, quote and booking workflow, verified-job reviews, messaging, notifications, Stripe test-mode integration, payment refunds/disputes, social moderation and reports, groups/events, and React Native apps.

## Functional research (no proprietary copying)

- https://www.taskrabbit.com/services
- https://support.taskrabbit.com/hc/en-gb/articles/46260422073755-How-Do-I-Hire-a-Tasker
- https://www.checkatrade.com/
- https://www.checkatrade.com/support/consumer/jobs/how-to-find-a-trade
- https://blog.nextdoor.com/whats-new-on-nextdoor-product-updates-2
