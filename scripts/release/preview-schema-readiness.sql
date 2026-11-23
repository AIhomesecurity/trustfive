-- Read-only catalog checks for an isolated preview before a signed-in rehearsal.
with required_tables(name) as (
  values ('job_bookings'), ('booking_reviews'), ('booking_appointments'), ('community_reports')
), catalogue as (
  select t.name, c.oid, c.relrowsecurity
  from required_tables t
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid and c.relname = t.name and c.relkind in ('r', 'p')
)
select 'rls:' || name as check_name, coalesce(relrowsecurity, false) as passed
from catalogue
union all
select 'booking_reviews:one_review_per_booking',
  exists (
    select 1
    from catalogue c
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'booking_id' and a.attnotnull
    join pg_constraint k on k.conrelid = c.oid and k.contype = 'u' and k.conkey = array[a.attnum]
    where c.name = 'booking_reviews'
  )
order by check_name;
