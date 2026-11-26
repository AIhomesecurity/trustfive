-- Read-only catalog checks for an isolated preview before a signed-in rehearsal.
with required_tables(name) as (
  values
    ('job_bookings'), ('booking_reviews'), ('booking_appointments'), ('community_reports'),
    ('professional_verification_submissions'), ('social_trade_requests'), ('social_trade_interests'),
    ('social_saved_posts'), ('community_group_post_reports'), ('community_post_media')
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
union all
select 'column:jobs.contact_preference',
  exists (
    select 1
    from pg_attribute
    where attrelid = to_regclass('public.jobs')
      and attname = 'contact_preference' and not attisdropped and attnotnull
  )
union all
select 'rpc:' || signature, to_regprocedure('public.' || signature) is not null
from (values
  ('withdraw_job_quote(uuid)'),
  ('customer_job_activity(uuid)'),
  ('submit_professional_verification(uuid,text,text,date,text,text,text)'),
  ('moderate_group_post_report(uuid,text)'),
  ('moderate_community_report(uuid,text)')
) as required_functions(signature)
union all
select 'index:jobs_customer_created_idx',
  exists (
    select 1 from pg_index
    where indexrelid = to_regclass('public.jobs_customer_created_idx')
      and indrelid = to_regclass('public.jobs') and indisvalid
  )
union all
select 'policy:community_group_posts membership',
  exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'community_group_posts'
      and policyname = 'group members read approved posts'
      and qual like '%community_group_memberships%'
  )
union all
select 'triggers:social_public_contact_guard',
  (select count(*) = 5
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public' and not t.tgisinternal
     and p.proname = 'enforce_public_social_contact_free'
     and c.relname in ('community_posts','community_comments','community_group_posts','community_groups','community_events'))
order by check_name;
