-- Add automatic re-verification flagging for active professionals whose
-- insurance has expired. Operational gap identified by the verification
-- sprint: the schema captured insurance_expires_on and submit_professional_verification
-- rejected past dates at submission time, but nothing acted on expiry AFTER
-- activation. An active professional with expired insurance is unsafe to
-- leave in a five-slot allocation.
--
-- This migration adds flag_expired_insurance_active_professionals(), an
-- admin-only RPC that suspends active professionals whose insurance has
-- expired, freeing their five-slot allocation for the next eligible
-- waiting-list applicant. Uses FOR UPDATE SKIP LOCKED for concurrency safety.
-- Admin-only (is_trustfive_admin gate). SECURITY DEFINER with fixed empty
-- search_path. Idempotent. Does not run automatically; triggering policy is
-- an operational decision for the owner.
begin;

create or replace function public.flag_expired_insurance_active_professionals()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer := 0;
  v_app record;
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  for v_app in
    select distinct al.application_id, vs.insurance_expires_on
    from public.active_allocations al
    join public.professional_applications pa on pa.id = al.application_id
    join public.professional_verification_submissions vs on vs.application_id = al.application_id
    where vs.insurance_expires_on < current_date
      and pa.status not in ('suspended','withdrawn','rejected')
    for update of al skip locked
  loop
    perform public.suspend_professional_application(
      v_app.application_id,
      'Insurance expired on ' || v_app.insurance_expires_on::text || '; automatic re-verification required.'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
revoke all on function public.flag_expired_insurance_active_professionals() from public, anon;
grant execute on function public.flag_expired_insurance_active_professionals() to authenticated;

comment on function public.flag_expired_insurance_active_professionals()
is 'Admin-only: suspends active professionals whose insurance has expired, freeing their five-slot allocation for the next eligible waiting-list applicant. Does not run automatically; intended for a scheduled job or manual admin invocation.';

commit;
