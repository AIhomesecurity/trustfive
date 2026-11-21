# TrustFive hosting decision — 19 November 2026

**Decision:** Keep Supabase PostgreSQL and Supabase Auth. Use Vercel for Next.js staging and production unless the owner explicitly chooses Firebase App Hosting. No deployment or spending is authorized by this document.

## Why
The five-slot allocation, quality assessments, vacancies, booking state transitions and audit logs rely on PostgreSQL constraints, row-level security and transactional functions. Migrating these to Firestore would introduce avoidable correctness and security risk.

Both Vercel and Firebase App Hosting support Next.js. Firebase App Hosting is a valid alternative for **hosting the web frontend** without migrating the database. It requires Firebase project setup and a Blaze billing plan. If Firebase hosting is chosen, configure the GitHub App Hosting backend, secrets and domain, but retain Supabase as the backend.

## Environments
- **Local:** .env.local (never commit).
- **Staging:** separate Supabase project, separate OAuth redirect URLs, test accounts and no real personal documents or live Stripe keys. A Vercel Preview branch can use staging environment variables; scope by branch to avoid accidental production database access.
- **Production:** trustfive.co.uk only after security, legal, monitoring, backup, domain and payment readiness reviews.

Required public environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Never put service-role keys, database passwords, Stripe secrets or OAuth client secrets into NEXT_PUBLIC_ variables. The Supabase publishable key is intended to be public; database RLS and server-side authorization are mandatory.

## Staging acceptance checklist
- [ ] Create a **separate staging Supabase project**; verify project ID and region.
- [ ] Review migrations and apply in order; do not run SQL against production as a smoke test.
- [ ] Connect GitHub preview branch to Vercel or Firebase App Hosting.
- [ ] Configure environment variables in host settings.
- [ ] Configure Supabase Auth site URL and allowed callback URLs for staging; configure Google/Apple OAuth only after credentials are provisioned.
- [ ] Verify /api/health returns 200 with configured environment (it does not expose credentials).
- [ ] Test email signup, email confirmation, password reset, signout and OAuth.
- [ ] Verify RLS with at least customer, approved professional, waiting applicant, unrelated user and admin accounts.
- [ ] Run end-to-end five-slot concurrency, vacancy expiry and booking completion tests against staging.
- [ ] Validate rate limits, spam protection, moderation, logs, backups, restore procedures and privacy notices.
- [ ] Keep Stripe in test mode until payment, VAT, refund and regulatory decisions are approved.
- [ ] Add monitoring and incident escalation before real users are invited.

## Deployment rollback
Revert the deployment to the last verified commit. Database changes must be forward-fixed using reviewed additive migrations; never assume a code rollback reverses database schema. Keep tested database backups and a restore drill.

## Sources
- https://supabase.com/kb/faqs/database/nextjs-on-vercel
- https://supabase.com/docs/guides/integrations/vercel-marketplace
- https://firebase.google.com/docs/app-hosting
