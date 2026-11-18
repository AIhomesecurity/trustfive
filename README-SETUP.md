TrustFive development foundation

1. npm install; copy .env.example to .env.local and set the Supabase publishable key locally (never commit secrets).
2. Apply supabase/migrations/0001_core.sql in your Supabase project's SQL editor after reviewing it.
3. In Supabase Authentication configure Site URL, redirect URL /auth/callback, email confirmation and Google/Apple providers as desired.
4. npm run dev; verify signup, email confirmation, sign-in, profile save and RLS with two separate accounts.
5. Before launch: add server-only audited activation workflow, payment processing, messaging, moderation, abuse prevention, monitoring and tests.

Current code is a development foundation, not a production-ready or deployed app. The five-slot UNIQUE constraint enforces a maximum of five slots per trade/area, but no professional activation UI is implemented yet.
