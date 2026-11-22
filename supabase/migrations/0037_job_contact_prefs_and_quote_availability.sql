-- Customer job contact preferences, structured quote availability notes,
-- and safe professional quote withdrawal (Task 3: agent/agy-bookings-quotes).
--
-- Preserves existing 11-arg create_job_with_private_location signature and
-- all private-address, five-slot, and RLS invariants.
begin;

-- 1. Safe post-booking contact preference on customer jobs (never exposes phone before booking).
alter table public.jobs
  add column if not exists contact_preference text not null default 'in_app_messages'
  check (contact_preference in ('in_app_messages','phone_after_booking','either_after_booking'));

create or replace function public.set_job_contact_preference(
  p_job uuid,
  p_preference text
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_preference not in ('in_app_messages','phone_after_booking','either_after_booking') then
    raise exception 'Unsupported contact preference';
  end if;
  update public.jobs
    set contact_preference = p_preference
    where id = p_job
      and customer_id = auth.uid()
      and status in ('draft','open');
  if not found then
    raise exception 'Job not found or cannot update contact preference' using errcode = '42501';
  end if;
end $$;
revoke all on function public.set_job_contact_preference(uuid,text) from public, anon;
grant execute on function public.set_job_contact_preference(uuid,text) to authenticated;

-- 2. Optional structured availability / earliest start window on professional quotations.
alter table public.job_quotes
  add column if not exists availability_note text
  check (availability_note is null or char_length(btrim(availability_note)) between 3 and 240);

-- Recreate customer_quotes() and professional_quotes() to surface availability_note cleanly.
drop function if exists public.customer_quotes();
create function public.customer_quotes()
returns table(
  quote_id uuid,
  job_id uuid,
  business_name text,
  amount_pence bigint,
  message text,
  availability_note text,
  status text,
  created_at timestamptz
) language sql stable security definer set search_path = ''
as $$
  select
    q.id,
    q.job_id,
    coalesce(ap.business_name, 'TrustFive professional'),
    q.amount_pence,
    q.message,
    q.availability_note,
    q.status,
    q.created_at
  from public.job_quotes q
  join public.jobs j on j.id = q.job_id
  left join public.active_allocations a on a.id = q.professional_allocation_id
  left join public.professional_applications ap on ap.id = a.application_id
  where j.customer_id = auth.uid()
  order by q.created_at desc
  limit 150;
$$;
revoke all on function public.customer_quotes() from public, anon;
grant execute on function public.customer_quotes() to authenticated;

drop function if exists public.professional_quotes();
create function public.professional_quotes()
returns table(
  quote_id uuid,
  job_id uuid,
  job_title text,
  amount_pence bigint,
  message text,
  availability_note text,
  status text,
  created_at timestamptz
) language sql stable security definer set search_path = ''
as $$
  select
    q.id,
    q.job_id,
    j.title,
    q.amount_pence,
    q.message,
    q.availability_note,
    q.status,
    q.created_at
  from public.job_quotes q
  join public.jobs j on j.id = q.job_id
  where q.professional_id = auth.uid()
  order by q.created_at desc
  limit 150;
$$;
revoke all on function public.professional_quotes() from public, anon;
grant execute on function public.professional_quotes() to authenticated;

-- 3. Allow owning professional to withdraw a still-pending quote safely.
create or replace function public.withdraw_job_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_job uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  update public.job_quotes
    set status = 'withdrawn'
    where id = p_quote
      and professional_id = auth.uid()
      and status = 'pending'
    returning job_id into v_job;
  if v_job is null then
    raise exception 'Pending quote not found or not authorised' using errcode = '42501';
  end if;
  insert into public.marketplace_audit_events(actor_id, action, job_id, quote_id)
    values (auth.uid(), 'quote_withdrawn', v_job, p_quote);
end $$;
revoke all on function public.withdraw_job_quote(uuid) from public, anon;
grant execute on function public.withdraw_job_quote(uuid) to authenticated;

commit;
