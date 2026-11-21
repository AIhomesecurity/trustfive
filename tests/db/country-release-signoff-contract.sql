-- Always-fail-closed release decision: zero real-world review cannot become
-- a launch approval. SQL fixture signoffs below exist ONLY inside a rolled-back
-- test transaction and are never real legal, payment or vetting evidence.
do $tf$
begin
 if to_regprocedure('public.trustfive_admin_country_release_gate(text)') is null
    or to_regprocedure('public.record_country_release_signoff(text,text,boolean,text,text)') is null then
  raise exception 'Country release gate or review RPC missing';
 end if;
 if has_table_privilege('anon','public.country_release_signoffs','SELECT')
   or has_table_privilege('authenticated','public.country_release_signoffs','SELECT')
   or has_table_privilege('anon','public.country_release_signoffs','INSERT')
   or has_table_privilege('authenticated','public.country_release_signoffs','INSERT')
   or has_function_privilege('anon','public.record_country_release_signoff(text,text,boolean,text,text)','EXECUTE')
   or has_function_privilege('anon','public.trustfive_admin_country_release_gate(text)','EXECUTE') then
  raise exception 'Release evidence or private operations leaked to API role';
 end if;
 if not has_function_privilege('authenticated','public.trustfive_admin_country_release_gate(text)','EXECUTE') then
  raise exception 'Authorised launch reviewers cannot inspect release state';
 end if;
end $tf$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
do $tf$
begin
 begin
  perform public.trustfive_admin_country_release_gate('GB');
  raise exception 'Non-admin could inspect private country approval state';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_country_release_signoff('GB','payments',true,
   repeat('not a real approval ',3),'Test reviewer');
  raise exception 'Non-admin could record release approval';
 exception when insufficient_privilege then null; end;
end $tf$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
do $tf$
declare
 gate text; status jsonb;
begin
 status:=public.trustfive_admin_country_release_gate('GB');
 if coalesce((status->>'eligibleForHumanReleaseReview')::boolean,true)
    or (status->>'productionAutomaticallyEnabled')::boolean is distinct from false then
  raise exception 'Unapproved UK country unexpectedly passed a release gate';
 end if;
 -- Fixture-only attestations exercise the review API. The entire transaction
 -- is rolled back, so none of these claims becomes real staging approval.
 foreach gate in array array[
   'legal_terms','privacy','payments','security','operational_support',
   'authenticated_acceptance'
 ] loop
  perform public.record_country_release_signoff('GB',gate,true,
   'ISOLATED CI TEST ONLY; deliberately not real proof or a review',
   'CI fixture reviewer');
 end loop;
 status:=public.trustfive_admin_country_release_gate('GB');
 if (status->>'humanApprovals')::integer<>6
    or jsonb_array_length(status->'missingApprovals')<>0 then
  raise exception 'Human evidence matrix failed to account for six test gates';
 end if;
 -- Required real reviewed boundaries and professional coverage cannot be
 -- manufactured by an unrelated legal/payment attestation.
 if (status->>'reviewedTerritories')::integer=0
    and (status->>'eligibleForHumanReleaseReview')::boolean then
  raise exception 'Fake CI attestations bypassed the geographic release gate';
 end if;
 perform public.record_country_release_signoff('GB','payments',false,
  'CI TEST ONLY: deliberately revoked payment evidence reference',
  'CI fixture reviewer');
 status:=public.trustfive_admin_country_release_gate('GB');
 if (status->>'humanApprovals')::integer<>5
    or not (status->'missingApprovals' ? 'payments')
    or (status->>'eligibleForHumanReleaseReview')::boolean then
  raise exception 'Revoked payment approval failed closed';
 end if;
end $tf$;
rollback;

select 'Country release attestations remain private and fail closed' as result;
