-- Close the identity-sequence ACL gap detected by the country-release audit
-- contract. Table RLS and table grants do not protect sequence operations.
-- This migration changes only privileges, not audit rows or human signoffs.
begin;

do $tf$
declare v_sequence text;
begin
 v_sequence := pg_get_serial_sequence('public.country_release_signoff_events','id');
 if v_sequence is null then
  raise exception 'Country release audit identity sequence missing';
 end if;
 execute format('revoke all privileges on sequence %s from public, anon, authenticated', v_sequence);
 if has_sequence_privilege('anon',v_sequence,'USAGE')
    or has_sequence_privilege('anon',v_sequence,'SELECT')
    or has_sequence_privilege('anon',v_sequence,'UPDATE')
    or has_sequence_privilege('authenticated',v_sequence,'USAGE')
    or has_sequence_privilege('authenticated',v_sequence,'SELECT')
    or has_sequence_privilege('authenticated',v_sequence,'UPDATE') then
  raise exception 'Country release audit identity sequence remains accessible to client roles';
 end if;
end $tf$;

commit;
