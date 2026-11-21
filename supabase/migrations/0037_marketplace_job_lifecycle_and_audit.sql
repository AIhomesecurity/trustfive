-- Customer job lifecycle RPCs (cancel unbooked job, reopen cancelled unbooked job,
-- and owner-scoped genuine audit activity log) (agent/agy-marketplace-lifecycle-and-hardening).
--
-- Coordinates cleanly alongside 0036_* migrations in PRs #28, #31, #32 without
-- modifying any existing table constraints, RLS policies, or five-slot rules.
begin;

-- 1. Cancel an unbooked customer job (draft or open). Rejects booked/completed jobs
-- and rejects any caller who does not own the job.
create or replace function public.cancel_customer_job(
  p_job uuid,
  p_reason text default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into v_job from public.jobs
    where id = p_job and customer_id = auth.uid() for update;
  if not found then
    raise exception 'Job not found or not authorised' using errcode = '42501';
  end if;
  if v_job.status not in ('draft','open') then
    raise exception 'Only draft or open jobs without a confirmed booking can be cancelled';
  end if;
  if exists(select 1 from public.job_bookings where job_id = p_job) then
    raise exception 'Cannot cancel a job that already has a booking';
  end if;

  update public.jobs set status = 'cancelled' where id = p_job;
  update public.job_quotes set status = 'rejected'
    where job_id = p_job and status = 'pending';

  insert into public.marketplace_audit_events(actor_id, action, job_id)
    values (auth.uid(), 'job_cancelled', p_job);
end $$;
revoke all on function public.cancel_customer_job(uuid,text) from public, anon;
grant execute on function public.cancel_customer_job(uuid,text) to authenticated;

-- 2. Reopen a cancelled unbooked job only when it still has valid trade + area and no booking.
create or replace function public.reopen_customer_job(p_job uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into v_job from public.jobs
    where id = p_job and customer_id = auth.uid() for update;
  if not found then
    raise exception 'Job not found or not authorised' using errcode = '42501';
  end if;
  if v_job.status <> 'cancelled' then
    raise exception 'Only cancelled jobs can be reopened';
  end if;
  if v_job.trade_id is null or v_job.area_id is null then
    raise exception 'Job requires a valid trade and service area to reopen';
  end if;
  if exists(select 1 from public.job_bookings where job_id = p_job) then
    raise exception 'Cannot reopen a job that already has a booking';
  end if;

  update public.jobs set status = 'open' where id = p_job;
  insert into public.marketplace_audit_events(actor_id, action, job_id)
    values (auth.uid(), 'job_reopened', p_job);
end $$;
revoke all on function public.reopen_customer_job(uuid) from public, anon;
grant execute on function public.reopen_customer_job(uuid) to authenticated;

-- 3. Owner-scoped chronological activity history derived strictly from genuine audit rows.
-- Never exposes actor UUIDs, private addresses, or other customers' jobs.
create or replace function public.customer_job_activity(p_job uuid)
returns table(
  event_id bigint,
  action text,
  created_at timestamptz
) language sql stable security definer set search_path = ''
as $$
  select e.id as event_id, e.action, e.created_at
  from public.marketplace_audit_events e
  join public.jobs j on j.id = e.job_id
  where e.job_id = p_job
    and j.customer_id = auth.uid()
  order by e.created_at asc, e.id asc
  limit 50;
$$;
revoke all on function public.customer_job_activity(uuid) from public, anon;
grant execute on function public.customer_job_activity(uuid) to authenticated;

commit;
