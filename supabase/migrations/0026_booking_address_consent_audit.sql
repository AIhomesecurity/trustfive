-- Record address-sharing consent and revocation without recording the address itself.
-- This is security-sensitive because booking addresses are private by default.
begin;
create table public.booking_address_consent_events(
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.job_bookings(id) on delete cascade,
 customer_id uuid not null references auth.users(id),
 sharing_enabled boolean not null,
 changed_at timestamptz not null default now()
);
create index booking_address_consent_events_booking_idx
 on public.booking_address_consent_events(booking_id,changed_at desc);
alter table public.booking_address_consent_events enable row level security;
revoke all on public.booking_address_consent_events from anon,authenticated;
comment on table public.booking_address_consent_events is
 'Server-only consent audit: booking ID, customer ID, consent state and timestamp; never store the private address or coordinates.';

create or replace function public.set_booking_address_sharing(p_booking uuid,p_allow boolean)
returns boolean language plpgsql volatile security definer set search_path=''
as $tf$
declare v_job uuid;v_allowed boolean;
begin
 if (select auth.uid()) is null then
  raise exception 'Sign in required' using errcode='42501';
 end if;
 if p_allow is null then
  raise exception 'Explicit consent choice required';
 end if;
 select b.job_id into v_job
 from public.job_bookings b
 where b.id=p_booking and b.customer_id=(select auth.uid())
  and b.status in ('booked','awaiting_customer')
 for update;
 if v_job is null then
  raise exception 'Booking not found or sharing unavailable' using errcode='42501';
 end if;
 update public.job_site_locations
 set share_with_booked_professional=p_allow
 where job_id=v_job
   and share_with_booked_professional is distinct from p_allow
 returning share_with_booked_professional into v_allowed;
 if found then
  insert into public.booking_address_consent_events
   (booking_id,customer_id,sharing_enabled)
  values(p_booking,(select auth.uid()),v_allowed);
 elsif not exists(select 1 from public.job_site_locations where job_id=v_job) then
  raise exception 'This booking does not have a selected private job-site address';
 end if;
 return p_allow;
end;
$tf$;
revoke all on function public.set_booking_address_sharing(uuid,boolean) from public,anon;
grant execute on function public.set_booking_address_sharing(uuid,boolean) to authenticated;
commit;
