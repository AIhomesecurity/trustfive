-- Professional onboarding, private verification submissions, permitted profile updates,
-- explicit suspended status and server-scoped onboarding status overview (Task 2).
--
-- Invariants preserved:
-- - Maximum 5 active approved professionals per trade per defined local area.
-- - Professionals can NEVER self-approve, alter status, or influence waitlist via payment.
-- - Verification records are strictly private to the owning applicant and TrustFive admins.
begin;

-- 1. Distinguish suspended applications explicitly alongside pending/under_review/eligible/rejected/withdrawn.
alter table public.professional_applications
  drop constraint if exists professional_applications_status_check;
alter table public.professional_applications
  add constraint professional_applications_status_check
  check (status in ('pending','under_review','eligible','rejected','withdrawn','suspended'));

-- 2. Private verification details submitted by applicants for independent admin review.
create table if not exists public.professional_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.professional_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  insurance_provider text not null check (char_length(btrim(insurance_provider)) between 2 and 120),
  insurance_policy_ref text not null check (char_length(btrim(insurance_policy_ref)) between 3 and 80),
  insurance_expires_on date not null,
  trade_body text check (trade_body is null or char_length(btrim(trade_body)) between 2 and 120),
  registration_number text check (registration_number is null or char_length(btrim(registration_number)) between 2 and 80),
  qualification_summary text not null check (char_length(btrim(qualification_summary)) between 15 and 1500),
  verification_status text not null default 'submitted'
    check (verification_status in ('submitted','under_review','verified','needs_more_info','rejected')),
  reviewer_note text check (reviewer_note is null or char_length(btrim(reviewer_note)) <= 1000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

create index if not exists professional_verification_submissions_user_idx
  on public.professional_verification_submissions(user_id, updated_at desc);

alter table public.professional_verification_submissions enable row level security;
revoke all on public.professional_verification_submissions from public, anon, authenticated;
grant select on public.professional_verification_submissions to authenticated;

create policy "applicants read own verification submissions"
  on public.professional_verification_submissions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "admins read all verification submissions"
  on public.professional_verification_submissions for select to authenticated
  using ((select public.is_trustfive_admin()));

-- 3. Applicant submits or updates private verification evidence (never self-approves).
create or replace function public.submit_professional_verification(
  p_application uuid,
  p_insurance_provider text,
  p_insurance_policy_ref text,
  p_insurance_expires_on date,
  p_trade_body text default null,
  p_registration_number text default null,
  p_qualification_summary text default ''
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.professional_applications%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into v_app from public.professional_applications
    where id = p_application and user_id = auth.uid() for update;
  if not found then
    raise exception 'Application not found or not authorised' using errcode = '42501';
  end if;
  if v_app.status in ('rejected','withdrawn','suspended') then
    raise exception 'Verification details cannot be submitted for this application status';
  end if;
  if p_insurance_expires_on is null or p_insurance_expires_on <= current_date then
    raise exception 'Insurance expiry date must be in the future';
  end if;
  if char_length(btrim(coalesce(p_insurance_provider,''))) not between 2 and 120
     or char_length(btrim(coalesce(p_insurance_policy_ref,''))) not between 3 and 80
     or char_length(btrim(coalesce(p_qualification_summary,''))) not between 15 and 1500 then
    raise exception 'Enter valid insurance and qualification details';
  end if;

  insert into public.professional_verification_submissions(
    application_id, user_id, insurance_provider, insurance_policy_ref,
    insurance_expires_on, trade_body, registration_number,
    qualification_summary, verification_status, reviewer_note,
    submitted_at, updated_at, reviewed_by, reviewed_at
  ) values (
    p_application, auth.uid(), btrim(p_insurance_provider), btrim(p_insurance_policy_ref),
    p_insurance_expires_on, nullif(btrim(coalesce(p_trade_body,'')),''),
    nullif(btrim(coalesce(p_registration_number,'')),''),
    btrim(p_qualification_summary), 'submitted', null,
    now(), now(), null, null
  )
  on conflict (application_id) do update set
    insurance_provider = excluded.insurance_provider,
    insurance_policy_ref = excluded.insurance_policy_ref,
    insurance_expires_on = excluded.insurance_expires_on,
    trade_body = excluded.trade_body,
    registration_number = excluded.registration_number,
    qualification_summary = excluded.qualification_summary,
    verification_status = 'submitted',
    reviewer_note = null,
    updated_at = now(),
    reviewed_by = null,
    reviewed_at = null
  returning id into v_id;

  insert into public.network_audit_events(actor_id, action, application_id, detail)
    values (auth.uid(), 'verification_submitted', p_application,
      jsonb_build_object('insurance_expires_on', p_insurance_expires_on));
  return v_id;
end $$;
revoke all on function public.submit_professional_verification(uuid,text,text,date,text,text,text) from public, anon;
grant execute on function public.submit_professional_verification(uuid,text,text,date,text,text,text) to authenticated;

-- 4. Applicant updates ONLY permitted business profile columns (never status, trade or area).
create or replace function public.update_my_professional_application_profile(
  p_application uuid,
  p_business_name text,
  p_about text,
  p_experience_years integer
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.professional_applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into v_app from public.professional_applications
    where id = p_application and user_id = auth.uid() for update;
  if not found then
    raise exception 'Application not found or not authorised' using errcode = '42501';
  end if;
  if v_app.status in ('withdrawn','suspended') then
    raise exception 'This application cannot be edited in its current status';
  end if;
  if char_length(btrim(coalesce(p_business_name,''))) not between 2 and 120 then
    raise exception 'Business name must be between 2 and 120 characters';
  end if;
  if char_length(btrim(coalesce(p_about,''))) not between 30 and 3000 then
    raise exception 'Services and qualifications must be between 30 and 3000 characters';
  end if;
  if p_experience_years is null or p_experience_years < 0 or p_experience_years > 80 then
    raise exception 'Experience years must be between 0 and 80';
  end if;

  update public.professional_applications
    set business_name = btrim(p_business_name),
        about = btrim(p_about),
        experience_years = p_experience_years
    where id = p_application and user_id = auth.uid();

  insert into public.network_audit_events(actor_id, action, application_id, detail)
    values (auth.uid(), 'application_profile_updated', p_application, '{}'::jsonb);
end $$;
revoke all on function public.update_my_professional_application_profile(uuid,text,text,integer) from public, anon;
grant execute on function public.update_my_professional_application_profile(uuid,text,text,integer) to authenticated;

-- 5. Admin-only verification submission status update (never auto-activates a slot).
create or replace function public.review_professional_verification(
  p_application uuid,
  p_status text,
  p_reviewer_note text default null
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_status not in ('under_review','verified','needs_more_info','rejected') then
    raise exception 'Invalid verification status';
  end if;
  update public.professional_verification_submissions
    set verification_status = p_status,
        reviewer_note = nullif(btrim(coalesce(p_reviewer_note,'')),''),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where application_id = p_application;
  if not found then
    raise exception 'Verification submission not found';
  end if;
  if p_status = 'under_review' then
    update public.professional_applications
      set status = 'under_review'
      where id = p_application and status = 'pending';
  end if;
  insert into public.network_audit_events(actor_id, action, application_id, detail)
    values (auth.uid(), 'verification_reviewed', p_application,
      jsonb_build_object('verification_status', p_status));
end $$;
revoke all on function public.review_professional_verification(uuid,text,text) from public, anon;
grant execute on function public.review_professional_verification(uuid,text,text) to authenticated;

-- 6. Admin-only suspension: safely vacates any active five-slot place, expires open offers,
-- marks application suspended, and frees capacity for the next waiting-list applicant.
create or replace function public.suspend_professional_application(
  p_application uuid,
  p_reason text
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_trade uuid;
  v_area uuid;
  v_had_slot boolean;
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 15 then
    raise exception 'An evidence-based suspension reason (at least 15 characters) is required';
  end if;
  select trade_id, area_id into v_trade, v_area
    from public.professional_applications where id = p_application for update;
  if v_trade is null then
    raise exception 'Application not found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_trade::text || ':' || v_area::text, 0));

  delete from public.active_allocations where application_id = p_application;
  v_had_slot := found;

  update public.vacancy_offers
    set status = 'expired', answered_at = coalesce(answered_at, now())
    where application_id = p_application and status in ('offered','accepted');

  update public.professional_applications
    set status = 'suspended'
    where id = p_application;

  insert into public.network_audit_events(actor_id, action, application_id, detail)
    values (auth.uid(), 'professional_suspended', p_application,
      jsonb_build_object('reason', btrim(p_reason), 'slot_vacated', v_had_slot));
end $$;
revoke all on function public.suspend_professional_application(uuid,text) from public, anon;
grant execute on function public.suspend_professional_application(uuid,text) to authenticated;

-- 7. Authenticated applicant read-only onboarding overview (strictly scoped to auth.uid()).
-- Returns genuine live DB state + aggregate 0..5 occupied slot count (never other pros' PII).
create or replace function public.my_professional_onboarding_status()
returns table (
  application_id uuid,
  business_name text,
  about text,
  experience_years integer,
  application_status text,
  submitted_at timestamptz,
  trade_id uuid,
  trade_name text,
  area_id uuid,
  area_name text,
  city text,
  assessment_state text,
  verification_submission_status text,
  verification_reviewer_note text,
  active_slot smallint,
  active_slots_filled integer,
  latest_offer_id uuid,
  latest_offer_status text,
  latest_offer_expires_at timestamptz,
  business_page_status text
) language sql stable security definer set search_path = ''
as $$
  select
    a.id as application_id,
    a.business_name,
    a.about,
    a.experience_years,
    a.status as application_status,
    a.submitted_at,
    t.id as trade_id,
    t.name as trade_name,
    s.id as area_id,
    s.area_name,
    s.city,
    qa.verification_state as assessment_state,
    vs.verification_status as verification_submission_status,
    vs.reviewer_note as verification_reviewer_note,
    alloc.slot as active_slot,
    (select count(*)::integer from public.active_allocations c
      where c.trade_id = a.trade_id and c.area_id = a.area_id) as active_slots_filled,
    vo.id as latest_offer_id,
    vo.status as latest_offer_status,
    vo.expires_at as latest_offer_expires_at,
    bp.status as business_page_status
  from public.professional_applications a
  join public.trades t on t.id = a.trade_id
  join public.service_areas s on s.id = a.area_id
  left join public.professional_assessments qa on qa.application_id = a.id
  left join public.professional_verification_submissions vs on vs.application_id = a.id
  left join public.active_allocations alloc on alloc.application_id = a.id
  left join public.professional_business_pages bp on bp.application_id = a.id
  left join lateral (
    select o.id, o.status, o.expires_at
    from public.vacancy_offers o
    where o.application_id = a.id
    order by o.offered_at desc
    limit 1
  ) vo on true
  where a.user_id = auth.uid()
  order by a.submitted_at desc
  limit 50;
$$;
revoke all on function public.my_professional_onboarding_status() from public, anon;
grant execute on function public.my_professional_onboarding_status() to authenticated;

commit;
