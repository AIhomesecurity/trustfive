# TrustFive test-mode business membership implementation

This folder provides code for an optional **£19.99/month professional business software membership**, not for ranking or professional approval. Subscription and commission/payment processing for customer jobs are separate unimplemented systems.

## Test-mode prerequisites (not completed)

1. Create a Stripe account and switch to **test mode**.
2. Create a GBP monthly recurring price for exactly **1,999 pence** with interval count 1. Save the Stripe `price_...` ID.
3. In a **private hosting environment**, set `STRIPE_SECRET_KEY` to a Stripe secret key beginning `sk_test_`; `STRIPE_MEMBERSHIP_PRICE_ID` to that price ID; and `TRUSTFIVE_APP_URL` to the exact staging origin (HTTPS outside localhost).
4. Create a Stripe webhook endpoint pointing to `https://STAGING_HOST/api/billing/webhook` and subscribe to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. In private hosting settings, set `STRIPE_WEBHOOK_SECRET` to the webhook's `whsec_...` signing secret. Set `SUPABASE_SERVICE_ROLE_KEY` to the **server-only** role key for the staging Supabase project.
6. Apply database migration `0009_stripe_test_memberships.sql` after earlier migrations. Test a professional account with a Stripe test card.
7. Verify the webhook creates or updates `business_memberships` and that duplicate/out-of-order events do not corrupt status. Confirm a different signed-in user cannot read or write it.

Never place secret keys in NEXT_PUBLIC environment variables, repository files, browser local storage or screenshots.

## Guardrails implemented

- Checkout is disabled unless the secret starts with `sk_test_` and the configured price is £19.99/month GBP.
- The route verifies a signed-in Supabase user with professional account type and an exact same-origin request.
- The browser never sets a price or Stripe customer ID directly.
- Checkout uses a Stripe-hosted subscription page; a redirect back to TrustFive **does not grant membership**.
- Only a correctly signed Stripe webhook updates the membership state through a service-role-only, idempotent PostgreSQL function.
- Incoming older events cannot overwrite newer subscription state for the same subscription.
- Membership never appears in the professional quality/verification/ranking functions.

## Deliberately NOT implemented

Production live payments; Stripe Connect onboarding; job commissions; customer escrow; professional payouts; refunds; a self-service cancellation portal; VAT/invoices; payment reconciliation; membership feature entitlements; UK consumer terms and privacy notices. Do not use this code to take live payments before financial, legal, operational and security review.

## Testing

GitHub Actions runs a PostgreSQL test harness with a simulated Supabase auth schema. It tests service-role-only execution, event replays, out-of-order events and owner-only membership reads. This is **not** a live Stripe or hosted Supabase integration test.

Sources: https://docs.stripe.com/payments/checkout and https://docs.stripe.com/webhooks
