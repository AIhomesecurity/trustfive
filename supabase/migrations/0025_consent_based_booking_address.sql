-- Consent-based disclosure of a private job-site address to the booked professional.
-- Only the booking customer can change consent. No public lead or quote reveals it.
begin;
alter table public.job_site_locations
 add column if not exists share_with_booked_professional boolean not null default false;

create or replace function public.set_booking_address_sharing(p_booking uuid,p_allow boolean)
returns boolean language plpgsql volatile security definer set search_path=''
as $tf$
declare v_job uuid;
begin
 if (select auth.uid()) is null then
  raise exception 'Sign in required' using errcode='42501';
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
 set share_with_booked_professional=coalesce(p_allow,false)
 where job_id=v_job;
 if not found then
  raise exception 'This booking does not have a selected private job-site address';
 end if;
 return coalesce(p_allow,false);
end;
$tf$;
revoke all on function public.set_booking_address_sharing(uuid,boolean) from public,anon;
grant execute on function public.set_booking_address_sharing(uuid,boolean) to authenticated;

create or replace function public.booking_job_site_address(p_booking uuid)
returns table(address_label text,postcode text,sharing_enabled boolean)
language sql stable security definer set search_path=''
as $tf$
 select l.address_label,l.postcode,l.share_with_booked_professional
 from public.job_bookings b
 join public.job_site_locations l on l.job_id=b.job_id
 where b.id=p_booking and (select auth.uid()) is not null
   and (
     b.customer_id=(select auth.uid())
     or (b.professional_id=(select auth.uid())
       and b.status in ('booked','awaiting_customer')
       and l.share_with_booked_professional)
   );
$tf$;
revoke all on function public.booking_job_site_address(uuid) from public,anon;
grant execute on function public.booking_job_site_address(uuid) to authenticated;
comment on function public.booking_job_site_address(uuid)
is 'Customer sees their address and sharing setting. Booked professional sees exact address only after explicit customer consent, while booking remains active. No other users receive rows.';
commit;