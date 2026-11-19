-- Appointment negotiation for accepted marketplace bookings.
-- No one can unilaterally CONFIRM a proposed time; the other party must accept.
begin;
create table public.booking_appointments(
 booking_id uuid primary key references public.job_bookings(id) on delete cascade,
 proposed_by uuid not null references public.profiles(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 timezone_name text not null check(char_length(timezone_name) between 3 and 80),
 status text not null default 'proposed'
  check(status in ('proposed','confirmed','cancelled')),
 confirmed_by uuid references public.profiles(id),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
alter table public.booking_appointments enable row level security;
create policy "booking participants see appointments" on public.booking_appointments
for select to authenticated using(exists(
 select 1 from public.job_bookings b where b.id=booking_id and
  (b.customer_id=(select auth.uid()) or b.professional_id=(select auth.uid()))
));
revoke insert,update,delete on public.booking_appointments from anon,authenticated;

alter table public.account_notifications
 drop constraint if exists account_notifications_kind_check;
alter table public.account_notifications
 add constraint account_notifications_kind_check check(kind in (
 'new_quote','quote_accepted','new_message','work_ready',
 'job_completed','vacancy_offer','appointment_proposed','appointment_confirmed','appointment_cancelled'
 ));

create or replace function public.propose_booking_appointment(
 p_booking uuid,p_start timestamptz,p_end timestamptz,p_timezone text
) returns void language plpgsql security definer set search_path=''
as $$
declare v_booking public.job_bookings%rowtype;v_other uuid;
begin
 select * into v_booking from public.job_bookings where id=p_booking for update;
 if not found or not (auth.uid()=v_booking.customer_id or auth.uid()=v_booking.professional_id) then
  raise exception 'Booking not found or not authorised' using errcode='42501';
 end if;
 if v_booking.status not in ('booked','awaiting_customer') then
  raise exception 'Only active bookings can be scheduled';
 end if;
 if p_start<=now() or p_start>now()+interval '365 days'
  or p_end<=p_start or p_end>p_start+interval '14 days' then
  raise exception 'Choose a future booking no longer than 14 days';
 end if;
 if p_timezone is null or length(p_timezone)>80 or not exists(
  select 1 from pg_catalog.pg_timezone_names where name=p_timezone
 ) then raise exception 'Use a valid IANA time zone'; end if;
 insert into public.booking_appointments(booking_id,proposed_by,starts_at,ends_at,timezone_name,status)
 values(p_booking,auth.uid(),p_start,p_end,p_timezone,'proposed')
 on conflict(booking_id) do update set
 proposed_by=excluded.proposed_by,starts_at=excluded.starts_at,
 ends_at=excluded.ends_at,timezone_name=excluded.timezone_name,
 status='proposed',confirmed_by=null,updated_at=now();
 v_other=case when auth.uid()=v_booking.customer_id
   then v_booking.professional_id else v_booking.customer_id end;
 insert into public.account_notifications(recipient_id,kind,title,body,target_path)
 values(v_other,'appointment_proposed','Booking time proposed',
 'The other booking participant proposed an appointment time.','/bookings');
 insert into public.marketplace_audit_events(actor_id,action,job_id,quote_id)
 values(auth.uid(),'appointment_proposed',v_booking.job_id,v_booking.quote_id);
end $$;
revoke all on function public.propose_booking_appointment(uuid,timestamptz,timestamptz,text)
 from public,anon;
grant execute on function public.propose_booking_appointment(uuid,timestamptz,timestamptz,text)
 to authenticated;

create or replace function public.confirm_booking_appointment(p_booking uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_booking public.job_bookings%rowtype;v_appointment public.booking_appointments%rowtype;
begin
 select * into v_booking from public.job_bookings where id=p_booking for update;
 if not found or not (auth.uid()=v_booking.customer_id or auth.uid()=v_booking.professional_id) then
  raise exception 'Booking not found or not authorised' using errcode='42501';
 end if;
 if v_booking.status not in ('booked','awaiting_customer') then
  raise exception 'Booking is no longer active';
 end if;
 select * into v_appointment from public.booking_appointments
 where booking_id=p_booking for update;
 if not found or v_appointment.status<>'proposed' or
   v_appointment.proposed_by=auth.uid() or v_appointment.starts_at<=now() then
   raise exception 'Only the other participant may confirm a future proposal';
 end if;
 -- Lock by professional to make competing confirmations serializable.
 perform pg_advisory_xact_lock(hashtextextended(v_booking.professional_id::text,15));
 if exists(
  select 1 from public.booking_appointments ap
  join public.job_bookings b on b.id=ap.booking_id
  where b.professional_id=v_booking.professional_id
    and ap.booking_id<>p_booking and ap.status='confirmed'
    and b.status in ('booked','awaiting_customer')
    and tstzrange(ap.starts_at,ap.ends_at,'[)') &&
        tstzrange(v_appointment.starts_at,v_appointment.ends_at,'[)')
 ) then raise exception 'Professional already has a confirmed appointment at that time'; end if;
 update public.booking_appointments set status='confirmed',
  confirmed_by=auth.uid(),updated_at=now()
 where booking_id=p_booking;
 insert into public.account_notifications(recipient_id,kind,title,body,target_path)
 values(v_appointment.proposed_by,'appointment_confirmed','Booking time confirmed',
 'Your proposed appointment time has been accepted.','/bookings');
 insert into public.marketplace_audit_events(actor_id,action,job_id,quote_id)
 values(auth.uid(),'appointment_confirmed',v_booking.job_id,v_booking.quote_id);
end $$;
revoke all on function public.confirm_booking_appointment(uuid) from public,anon;
grant execute on function public.confirm_booking_appointment(uuid) to authenticated;

create or replace function public.cancel_booking_appointment(p_booking uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_booking public.job_bookings%rowtype;v_other uuid;
begin
 select * into v_booking from public.job_bookings where id=p_booking for update;
 if not found or not (auth.uid()=v_booking.customer_id or auth.uid()=v_booking.professional_id) then
  raise exception 'Booking not found or not authorised' using errcode='42501';
 end if;
 update public.booking_appointments set status='cancelled',updated_at=now()
  where booking_id=p_booking and status in ('proposed','confirmed');
 if not found then raise exception 'No active appointment to cancel'; end if;
 v_other=case when auth.uid()=v_booking.customer_id
  then v_booking.professional_id else v_booking.customer_id end;
 insert into public.account_notifications(recipient_id,kind,title,body,target_path)
 values(v_other,'appointment_cancelled','Booking time cancelled',
 'The other participant cancelled the agreed or proposed time.','/bookings');
 insert into public.marketplace_audit_events(actor_id,action,job_id,quote_id)
 values(auth.uid(),'appointment_cancelled',v_booking.job_id,v_booking.quote_id);
 -- This cancels only the appointment, not the underlying booking/payment.
end $$;
revoke all on function public.cancel_booking_appointment(uuid) from public,anon;
grant execute on function public.cancel_booking_appointment(uuid) to authenticated;
commit;