-- TrustFive Social: hard anti-bypass contact/link constraints across all Social
-- posts/comments/groups, plus customer-consented zero-PII trade-to-trade referrals.
-- Preserves the 5-professional cap, payment-independent ranking, private addresses
-- and pilot-only ledger boundaries (no live money transfers).
begin;

-- 1. Enforce zero phone numbers, emails, websites/domains, WhatsApp/Telegram
--    handles, obfuscated digits and full UK postcodes at the PostgreSQL layer
--    using the canonical showcase_contact_free() validator from migration 0054.
alter table public.community_posts
  add constraint community_posts_contact_free
  check (public.showcase_contact_free(body));

alter table public.community_comments
  add constraint community_comments_contact_free
  check (public.showcase_contact_free(body));

alter table public.community_group_posts
  add constraint community_group_posts_contact_free
  check (public.showcase_contact_free(body));

-- 2. Trade-to-trade referral & job-swap bridge (zero customer PII, pilot ledger only).
--    Referring tradespeople never upload customer phone numbers or addresses; instead
--    they generate a transparent customer-consented TrustFive referral link so the
--    homeowner posts/books inside the app and still compares eligible approved pros.
create table public.social_trade_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_trade_id uuid not null references public.trades(id),
  area_id uuid not null references public.service_areas(id),
  recommended_application_id uuid references public.professional_applications(id) on delete set null,
  summary text not null check (
    char_length(btrim(summary)) between 15 and 600
    and public.showcase_contact_free(summary)
  ),
  referral_code text not null unique
    default ('TF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
    check (referral_code ~ '^TF-[A-Z0-9]{10}$'),
  referrer_share_bps integer not null default 500 check (referrer_share_bps between 0 and 1000),
  platform_share_bps integer not null default 300 check (platform_share_bps between 0 and 500),
  settlement_mode text not null default 'pilot_ledger_only'
    check (settlement_mode = 'pilot_ledger_only'),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index social_trade_referrals_browse_idx
  on public.social_trade_referrals (area_id, target_trade_id, status, created_at desc);
create index social_trade_referrals_referrer_idx
  on public.social_trade_referrals (referrer_id, created_at desc);

alter table public.social_trade_referrals enable row level security;
revoke all on public.social_trade_referrals from public, anon, authenticated;
grant select on public.social_trade_referrals to authenticated;
grant insert (
  referrer_id,
  target_trade_id,
  area_id,
  recommended_application_id,
  summary,
  referrer_share_bps,
  platform_share_bps
) on public.social_trade_referrals to authenticated;
grant update (status) on public.social_trade_referrals to authenticated;

create policy "registered professionals browse open trade referrals"
  on public.social_trade_referrals for select to authenticated
  using (
    referrer_id = (select auth.uid())
    or (select public.is_trustfive_admin())
    or (
      status = 'open'
      and exists (
        select 1 from public.professional_applications a
        where a.user_id = (select auth.uid())
          and a.status in ('pending', 'under_review', 'eligible')
      )
    )
  );

create policy "registered professionals create zero-PII trade referrals"
  on public.social_trade_referrals for insert to authenticated
  with check (
    referrer_id = (select auth.uid())
    and status = 'open'
    and settlement_mode = 'pilot_ledger_only'
    and exists (
      select 1 from public.professional_applications a
      where a.user_id = (select auth.uid())
        and a.status in ('pending', 'under_review', 'eligible')
    )
    and (
      recommended_application_id is null
      or public.is_active_approved_application(recommended_application_id)
    )
  );

create policy "referrer closes or reopens own trade referrals"
  on public.social_trade_referrals for update to authenticated
  using (referrer_id = (select auth.uid()))
  with check (referrer_id = (select auth.uid()) and status in ('open', 'closed'));

create trigger quota_social_trade_referrals before insert on public.social_trade_referrals
  for each row execute function public.enforce_account_write_quota('social_trade_referral', '10', 'day');

commit;
