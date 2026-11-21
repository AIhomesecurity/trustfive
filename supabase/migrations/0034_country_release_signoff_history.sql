-- Immutable, private audit events for country release signoff approval/revocation.
-- The current signoff row may be superseded, but its history must not vanish.
begin;

create table public.country_release_signoff_events (
 id bigint generated always as identity primary key,
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 gate text not null check(gate in (
  'legal_terms','privacy','payments','security','operational_support',
  'authenticated_acceptance'
 )),
 approved boolean not null,
 evidence_reference text not null,
 reviewer_name text not null,
 recorded_by uuid not null references auth.users(id),
 changed_at timestamptz not null default now()
);
create index country_release_events_country_time_idx
 on public.country_release_signoff_events(country_code,changed_at desc);
alter table public.country_release_signoff_events enable row level security;
revoke all on public.country_release_signoff_events from public,anon,authenticated;
comment on table public.country_release_signoff_events is
 'Private append-only history of human launch attestations and revocations; no confidential document or customer address stored.';

create or replace function public.log_country_release_signoff_change()
returns trigger language plpgsql security definer set search_path=''
as $tf$
begin
 insert into public.country_release_signoff_events
  (country_code,gate,approved,evidence_reference,reviewer_name,recorded_by)
 values
  (new.country_code,new.gate,new.approved,new.evidence_reference,new.reviewer_name,new.recorded_by);
 return new;
end;
$tf$;
revoke all on function public.log_country_release_signoff_change()
 from public,anon,authenticated;

create trigger audit_country_release_signoff_change
after insert or update on public.country_release_signoffs
for each row execute function public.log_country_release_signoff_change();

do $tf$
begin
 if has_table_privilege('authenticated','public.country_release_signoff_events','SELECT')
    or has_table_privilege('anon','public.country_release_signoff_events','SELECT')
    or has_table_privilege('authenticated','public.country_release_signoff_events','INSERT')
    or has_function_privilege('authenticated','public.log_country_release_signoff_change()','EXECUTE')
    or has_function_privilege('anon','public.log_country_release_signoff_change()','EXECUTE')
 then raise exception 'Private release attestation history exposed to client roles'; end if;
end $tf$;
commit;
