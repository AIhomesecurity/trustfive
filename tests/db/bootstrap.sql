-- A local PostgreSQL test harness that mimics Supabase's minimum auth schema.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
grant usage on schema public to anon,authenticated;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated,anon;
alter default privileges in schema public grant usage,select on sequences to authenticated,anon;
