-- Once a professional saves any weekly hours, omitted weekdays are unavailable.
-- Professionals with no configured weekly pattern retain the legacy booking flow.
begin;

create or replace function public.enforce_professional_availability_for_appointment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_professional uuid;
  v_has_schedule boolean;
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
  select exists (
    select 1 from public.professional_weekly_availability w
    where w.professional_id = v_professional
  ) into v_has_schedule;
  if v_has_schedule then
    select w.is_available, w.starts_at, w.ends_at, w.break_starts_at,
           w.break_ends_at, w.travel_buffer_minutes
      into v_available, v_work_start, v_work_end, v_break_start,
           v_break_end, v_buffer
    from public.professional_weekly_availability w
    where w.professional_id = v_professional and w.weekday = v_weekday;

    if not found or not coalesce(v_available, false) then
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

commit;
