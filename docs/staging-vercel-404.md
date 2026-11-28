# TrustFive Vercel staging deployment and 404 resolution

## Confirmed GitHub facts (19 November 2026)
- Repository: https://github.com/AIhomesecurity/trustfive
- Default branch: `main`, containing only `README.md`.
- Web application source: `feature/verified-marketplace-core` (draft PR #1), proposed to merge into `development/foundation`.
- Next.js app root: repository root `/`, NOT `/app`.
- GitHub Actions Next.js build, server HTTP smoke and Chromium browser test workflow are present.
- The existing 404 cannot be conclusively attributed to one deployment without the Vercel project URL and deployment logs.

## Correct the branch mismatch before public launch
If Vercel is tracking only `main`, the application cannot deploy from that branch as it currently contains no Next.js app. Keep the current branch as a **private Preview deployment**, or merge reviewed code into the correct development branch and configure a dedicated staging branch in Vercel. Do not deploy the unfinished app to the public domain by prematurely merging draft work to `main`.

## Staging setup
1. In Vercel, import the GitHub repository `AIhomesecurity/trustfive`. Confirm GitHub permissions for the repository.
2. Set Framework to **Next.js**; Root Directory to the **repository root**; no `output: export` or custom build output directory. Use Node.js 22.
3. Configure a Preview deployment for `feature/verified-marketplace-core` and inspect its build logs. Vercel may require a first production-branch import before it generates previews.
4. Provision a **separate staging Supabase project**, preferably a region compatible with the intended UK launch. Do not run migrations in the existing project until its production/staging purpose and backups are confirmed.
5. Apply reviewed SQL migrations `0001` through `0013` in strict order to staging. Verify table creation, RLS and administrator grants.
6. In Vercel Preview environment variables, set only the staging `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not commit secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` out of Preview until Stripe webhook tests require it.
7. Configure Supabase Auth Site URL and allow-list callback `https://YOUR_VERIFIED_PREVIEW_DOMAIN/auth/callback`. Enable email confirmation and configure Google/Apple only when their provider credentials exist.
8. Visit these routes on the **actual Vercel Preview URL**:
   - `/` must show the TrustFive homepage;
   - `/api/health` returns config presence, not a verified database connection;
   - `/api/health/ready` returns 200 only when the staging database is accessible and migration `0001` is present;
   - `/account` shows registration;
   - `/dashboard` redirects an unauthenticated visitor to `/account`.
9. Test creating two independent accounts and confirm cross-account RLS restrictions. Verify professional approval and slot capacity using human-reviewed test accounts only.
10. Keep billing in Stripe **test mode**. Configure `TRUSTFIVE_APP_URL` to the exact staging origin before allowing checkout testing.

## Resolving an existing Vercel 404
- If the Vercel project/deployment does not exist, import it and deploy the correct branch.
- If a deployment is Ready but every route returns 404, verify framework detection, repository root, build output and routes; inspect the deployment's Function/Build logs.
- If only `trustfive.co.uk` fails, check whether the domain is associated with the correct Vercel project, then inspect DNS and Vercel's domain verification status.
- Do not invent the `*.vercel.app` URL. Record and test the actual URL Vercel returns after a successful deployment.

## Production gate
Do not attach the public domain or collect real payment/identity documents until legal, privacy, moderation, abuse, security, verified-provider operations and payment reconciliation checks pass.

Reference: https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404
