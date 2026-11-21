-- Migration 0038: User regional display preferences (internationalisation readiness).
--
-- IMPORTANT SCOPE & SAFETY INVARIANT:
-- This table stores optional DISPLAY formatting preferences (country preview,
-- locale, currency display example and IANA timezone) for signed-in users.
-- Saving a preference NEVER:
--   1. Changes a customer's property address or a professional's verified service area.
--   2. Approves, unlocks or activates any country, territory or booking slot.
--   3. Converts or alters legal job/quote currencies (existing amounts stay in GBP).

create table if not exists public.user_regional_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_country_code text not null default 'GB'
    check (display_country_code in ('GB', 'US', 'IE', 'AU', 'CA', 'NZ', 'IN', 'JP')),
  display_locale text not null default 'en-GB'
    check (display_locale in ('en-GB', 'en-US', 'en-IE', 'en-AU', 'en-CA', 'en-NZ', 'en-IN', 'ja-JP')),
  display_currency text not null default 'GBP'
    check (display_currency in ('GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD', 'INR', 'JPY')),
  display_timezone text not null default 'Europe/London'
    check (char_length(display_timezone) between 3 and 80),
  updated_at timestamptz not null default now()
);

comment on table public.user_regional_preferences is
  'Optional per-user regional display formatting preferences only. Never changes property/business location, never activates unapproved countries/territories, and never converts legal quote or job currencies.';

alter table public.user_regional_preferences enable row level security;
alter table public.user_regional_preferences force row level security;

revoke all on table public.user_regional_preferences from public, anon, authenticated;
grant select on table public.user_regional_preferences to authenticated;
grant select, insert, update, delete on table public.user_regional_preferences to service_role;

drop policy if exists regional_preferences_select_own on public.user_regional_preferences;
create policy regional_preferences_select_own
  on public.user_regional_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.save_my_regional_preferences(
  p_country text,
  p_locale text,
  p_currency text,
  p_timezone text
)
returns public.user_regional_preferences
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid;
  v_country text;
  v_locale text;
  v_currency text;
  v_timezone text;
  v_row public.user_regional_preferences;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required to save account regional preferences';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'User profile not found';
  end if;

  v_country := upper(trim(coalesce(p_country, '')));
  if v_country not in ('GB', 'US', 'IE', 'AU', 'CA', 'NZ', 'IN', 'JP') then
    raise exception 'Unsupported display country code: %', v_country;
  end if;

  v_locale := trim(coalesce(p_locale, ''));
  if v_locale not in ('en-GB', 'en-US', 'en-IE', 'en-AU', 'en-CA', 'en-NZ', 'en-IN', 'ja-JP') then
    raise exception 'Unsupported display locale: %', v_locale;
  end if;

  v_currency := upper(trim(coalesce(p_currency, '')));
  if v_currency not in ('GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD', 'INR', 'JPY') then
    raise exception 'Unsupported display currency: %', v_currency;
  end if;

  v_timezone := trim(coalesce(p_timezone, ''));
  if char_length(v_timezone) < 3
     or char_length(v_timezone) > 80
     or not exists (
       select 1
       from pg_catalog.pg_timezone_names
       where name = v_timezone
     ) then
    raise exception 'Unsupported IANA timezone: %', v_timezone;
  end if;

  insert into public.user_regional_preferences (
    user_id,
    display_country_code,
    display_locale,
    display_currency,
    display_timezone,
    updated_at
  )
  values (
    v_uid,
    v_country,
    v_locale,
    v_currency,
    v_timezone,
    now()
  )
  on conflict (user_id) do update
  set
    display_country_code = excluded.display_country_code,
    display_locale = excluded.display_locale,
    display_currency = excluded.display_currency,
    display_timezone = excluded.display_timezone,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$fn$;

comment on function public.save_my_regional_preferences(text, text, text, text) is
  'Validated self-service RPC for saving a signed-in user''s optional display formatting preferences. Enforces IANA timezone validation and never activates unapproved countries or alters legal quote currencies.';

revoke all on function public.save_my_regional_preferences(text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_my_regional_preferences(text, text, text, text) to authenticated;
