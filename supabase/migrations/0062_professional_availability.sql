-- Private weekly availability and time-off controls for professional accounts.
-- These settings do not alter vetting, the five-slot cap, directory order, or payment state.
begin;

create table public.professional_weekly_availability (
  professional_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_available boolean not null default false,
  starts_at time,
  ends_at time,
  break_starts_at time,
  break_ends_at time,
  travel_buffer_minutes smallint not null default 0 check (travel_buffer_minutes between 0 and 240),
  updated_at timestamptz not null default now(),
  primary key (professional_id, weekday),
  check (
    (is_available and starts_at is not null and ends_at is not null and ends_at > starts_at)
    or (not is_available and starts_at is null and ends_at is null)
  ),
  check (
    (break_starts_at is null and break_ends_at is null)
    or (is_available and break_starts_at is not null and break_ends_at is not null
      and break_starts_at >= starts_at and break_ends_at > break_starts_at and break_ends_at <= ends_at)
  )
);

create table public.professional_time_off (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index professional_time_off_owner_start_idx
  on public.professional_time_off(professional_id, starts_at);

alter table public.professional_weekly_availability enable row level security;
alter table public.professional_time_off enable row level security;
revoke all on public.professional_weekly_availability, public.professional_time_off from public, anon, authenticated;
grant select on public.professional_weekly_availability, public.professional_time_off to authenticated;

create policy "professionals read own weekly availability"
  on public.professional_weekly_availability for select to authenticated
  using (professional_id = (select auth.uid()));
create policy "professionals read own time off"
  on public.professional_time_off for select to authenticated
  using (professional_id = (select auth.uid()));

create or replace function public.save_my_weekly_availability(
  p_weekday smallint,
  p_is_available boolean,
  p_starts_at time default null,
  p_ends_at time default null,
  p_break_starts_at time default null,
  p_break_ends_at time default null,
  p_travel_buffer_minutes smallint default 0
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.requested_role = 'professional'
  ) then
    raise exception 'A professional account is required' using errcode = '42501';
  end if;
  if p_weekday not between 0 and 6 then raise exception 'Choose a valid day of the week'; end if;
  if p_travel_buffer_minutes not between 0 and 240 then raise exception 'Travel buffer must be between 0 and 240 minutes'; end if;
  if p_is_available and (p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at) then
    raise exception 'Choose a valid working-hours range';
  end if;
  if not p_is_available and (p_starts_at is not null or p_ends_at is not null
      or p_break_starts_at is not null or p_break_ends_at is not null) then
    raise exception 'Unavailable days cannot include working or break hours';
  end if;
  if (p_break_starts_at is null) <> (p_break_ends_at is null)
     or (p_break_starts_at is not null and (not p_is_available or p_break_starts_at < p_starts_at
       or p_break_ends_at <= p_break_starts_at or p_break_ends_at > p_ends_at)) then
    raise exception 'Break must be fully inside working hours';
  end if;
  insert into public.professional_weekly_availability(
    professional_id, weekday, is_available, starts_at, ends_at,
    break_starts_at, break_ends_at, travel_buffer_minutes, updated_at
  ) values (
    (select auth.uid()), p_weekday, p_is_available, p_starts_at, p_ends_at,
    p_break_starts_at, p_break_ends_at, p_travel_buffer_minutes, now()
  ) on conflict (professional_id, weekday) do update set
    is_available = excluded.is_available,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    break_starts_at = excluded.break_starts_at,
    break_ends_at = excluded.break_ends_at,
    travel_buffer_minutes = excluded.travel_buffer_minutes,
    updated_at = now();
end;
$$;
revoke all on function public.save_my_weekly_availability(smallint,boolean,time,time,time,time,smallint) from public, anon;
grant execute on function public.save_my_weekly_availability(smallint,boolean,time,time,time,time,smallint) to authenticated;

create or replace function public.add_my_time_off(
  p_starts_at timestamptz, p_ends_at timestamptz, p_note text default ''
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.requested_role = 'professional'
  ) then raise exception 'A professional account is required' using errcode = '42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now()
     or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '90 days' then
    raise exception 'Time off must be a future range of 90 days or less';
  end if;
  if char_length(coalesce(p_note, '')) > 120 then raise exception 'Note must be 120 characters or fewer'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((select auth.uid())::text, 31));
  if exists (select 1 from public.professional_time_off t
    where t.professional_id = (select auth.uid())
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then
    raise exception 'This time off overlaps another unavailable period';
  end if;
  insert into public.professional_time_off(professional_id, starts_at, ends_at, note)
    values ((select auth.uid()), p_starts_at, p_ends_at, btrim(coalesce(p_note, '')))
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_my_time_off(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.add_my_time_off(timestamptz,timestamptz,text) to authenticated;

create or replace function public.remove_my_time_off(p_time_off uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.professional_time_off
  where id = p_time_off and professional_id = (select auth.uid());
  if not found then raise exception 'Unavailable period not found'; end if;
end;
$$;
revoke all on function public.remove_my_time_off(uuid) from public, anon;
grant execute on function public.remove_my_time_off(uuid) to authenticated;

-- When a professional has saved a weekly pattern, reject proposed and confirmed
-- appointments outside that pattern, during breaks/time off, or inside travel-buffer
-- windows around an existing confirmed appointment. Unconfigured professionals retain
-- the existing mutually-confirmed appointment flow until they choose to set hours.
create or replace function public.enforce_professional_availability_for_appointment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_professional uuid;
  v_configured boolean;
  v_available boolean;
  v_work_start time;
  v_work_end time;
  v_break_start time;
  v_break_end time;
  v_buffer smallint := 0;
  v_weekday smallint;
begin
  if new.status not in ('proposed','confirmed') then return new; end if;
  select b.professional_id into v_professional
  from public.job_bookings b where b.id = new.booking_id;
  if v_professional is null then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_professional::text, 15));
  v_weekday := extract(dow from new.starts_at at time zone new.timezone_name)::smallint;
  select true, w.is_available, w.starts_at, w.ends_at, w.break_starts_at,
         w.break_ends_at, w.travel_buffer_minutes
    into v_configured, v_available, v_work_start, v_work_end, v_break_start,
         v_break_end, v_buffer
  from public.professional_weekly_availability w
  where w.professional_id = v_professional and w.weekday = v_weekday;

  if coalesce(v_configured, false) then
    if not coalesce(v_available, false) then
      raise exception 'This professional is not available on that day';
    end if;
    if (new.starts_at at time zone new.timezone_name)::date <>
       (new.ends_at at time zone new.timezone_name)::date then
      raise exception 'Choose an appointment that fits within one working day';
    end if;
    if (new.starts_at at time zone new.timezone_name)::time < v_work_start
       or (new.ends_at at time zone new.timezone_name)::time > v_work_end then
      raise exception 'Choose a time inside the professional working hours';
    end if;
    if v_break_start is not null and
      tstzrange(new.starts_at, new.ends_at, '[)') && tstzrange(
        ((new.starts_at at time zone new.timezone_name)::date + v_break_start) at time zone new.timezone_name,
        ((new.starts_at at time zone new.timezone_name)::date + v_break_end) at time zone new.timezone_name,
        '[)'
      ) then
      raise exception 'Choose a time outside the professional break';
    end if;
  end if;

  if exists (
    select 1 from public.professional_time_off t
    where t.professional_id = v_professional
      and tstzrange(new.starts_at - pg_catalog.make_interval(mins => coalesce(v_buffer,0)),
                    new.ends_at + pg_catalog.make_interval(mins => coalesce(v_buffer,0)), '[)')
          && tstzrange(t.starts_at, t.ends_at, '[)')
  ) then
    raise exception 'This professional is unavailable during that period';
  end if;

  if exists (
    select 1
    from public.booking_appointments ap
    join public.job_bookings b on b.id = ap.booking_id
    left join public.professional_weekly_availability w on w.professional_id = b.professional_id
      and w.weekday = extract(dow from ap.starts_at at time zone ap.timezone_name)::smallint
    where b.professional_id = v_professional
      and ap.booking_id <> new.booking_id
      and ap.status = 'confirmed'
      and b.status in ('booked','awaiting_customer')
      and tstzrange(new.starts_at - pg_catalog.make_interval(mins => coalesce(v_buffer,0)),
                    new.ends_at + pg_catalog.make_interval(mins => coalesce(v_buffer,0)), '[)')
          && tstzrange(ap.starts_at - pg_catalog.make_interval(mins => coalesce(w.travel_buffer_minutes,0)),
                       ap.ends_at + pg_catalog.make_interval(mins => coalesce(w.travel_buffer_minutes,0)), '[)')
  ) then
    raise exception 'This time conflicts with a confirmed appointment or its travel buffer';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_professional_availability_for_appointment() from public, anon, authenticated;
drop trigger if exists enforce_professional_availability_for_appointment on public.booking_appointments;
create trigger enforce_professional_availability_for_appointment
before insert or update of starts_at, ends_at, timezone_name, status
on public.booking_appointments
for each row execute function public.enforce_professional_availability_for_appointment();

commit;
