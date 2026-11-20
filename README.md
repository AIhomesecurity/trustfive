# TrustFive.co.uk

An original, UK-first marketplace and neighbourhood community platform, designed for future worldwide expansion.

## Development status

This is **a development foundation, not a production-ready or deployed business**. The current Next.js app includes customer/professional registration, profile editing, reviewed public business pages, job requests, searchable approved professionals, trade-area applications, vacancy responses, neighbourhood posts and comments, reporting, and a database allocation engine. Features are only functional after installing dependencies, configuring Supabase and applying migrations. External OAuth provider configuration, live professional verification, authenticated hosted Supabase end-to-end testing, live payments, mobile apps and production operations are not yet complete. A test-only Stripe billing checkout and signed-webhook foundation has been added; it is disabled until the owner configures test keys. Automated GitHub Actions checks cover TypeScript, Next.js build, HTTP smoke tests, Chromium browser routes and a simulated Supabase-auth PostgreSQL test harness.

## Setup

1. Install Node.js 22; run `npm install`.
2. Copy `.env.example` to `.env.local` and insert the Supabase *publishable* key. Never commit passwords, secret keys or service-role keys.
3. Review **all** numbered SQL files in `supabase/migrations/` in ascending order, not just the original `0001`–`0013` foundation. Before applying anything to an existing database, compare its applied migration history and schema with the repository and apply only missing, reviewed migrations using the project's established staging migration procedure. **Do not rerun the whole directory against an existing database or apply migrations to production without approval.** Run the database integration/security contracts before and after a staging change.
4. Configure Supabase Auth site URL (`http://localhost:3000`) and callback redirect (`http://localhost:3000/auth/callback`). Configure Google/Apple credentials in their respective provider consoles before enabling OAuth.
5. Run `npm run dev` and test independently using at least two user accounts.

## Admin access

Admin rights cannot be granted from the signup form. Once you have verified the administrator's account identity, a database owner must deliberately execute:

```sql
insert into public.platform_admins(user_id)
values ('REPLACE_WITH_VERIFIED_ADMIN_USER_UUID');
```

The approval functions require admin authorization. Do not set `verification_state='verified'` unless actual identification, qualifications, licences and insurance documents have been checked outside the app. The code includes mutually confirmed appointment scheduling (without payment processing), a recorded written complaint and appeal process, but does not yet include secure document collection, expiry checks, complete investigation procedures or professional document verification.

## Core selection rule

Up to five slots exist per trade-area pair, enforced by a unique trade/area/slot constraint, with a maximum of five. Qualified applicants enter an independent score-based queue; earlier applications win score ties. Admin-reviewed compliance and score (not payment) determine eligibility. Selected applicants must accept a vacancy offer before activation. A reviewed adverse incident requires evidence and fair human oversight.

## Roadmap

Security review, additional automated browser/e2e tests, secure proof-of-qualification uploads, provider notifications, real-time messaging delivery, Stripe test-mode integration, payment refunds/disputes, expanded moderation, address/location verification, real-time notifications, and React Native apps. Group discovery, group posts, local events, RSVP and in-app notifications are implemented as database-backed development features, with no email/push delivery yet. Current quotes, bookings and verified-job reviews are implemented in source and local database integration tests, but the complete authenticated customer-to-professional flow has not been verified against hosted staging. Database-level staging security contracts do not substitute for this end-to-end test.

## Functional research (no proprietary copying)

- https://www.taskrabbit.com/services
- https://support.taskrabbit.com/hc/en-gb/articles/46260422073755-How-Do-I-Hire-a-Tasker
- https://www.checkatrade.com/
- https://www.checkatrade.com/support/consumer/jobs/how-to-find-a-trade
- https://blog.nextdoor.com/whats-new-on-nextdoor-product-updates-2
