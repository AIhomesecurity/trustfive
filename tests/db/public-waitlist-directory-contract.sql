-- Read-only shape and privilege contract for the public opt-in applicant directory.
do $contract$
declare
  v_public_proc oid := 'public.find_trustfive_waitlist_profiles(uuid,uuid)'::regprocedure;
  v_owner_proc oid := 'public.set_my_waitlist_public_profile(uuid,text,text,boolean)'::regprocedure;
  v_my_proc oid := 'public.my_waitlist_public_profiles()'::regprocedure;
  v_result text;
begin
  if has_table_privilege('anon','public.professional_waitlist_profiles','SELECT')
     or has_table_privilege('anon','public.professional_waitlist_profiles','INSERT')
     or has_table_privilege('anon','public.professional_waitlist_profiles','UPDATE')
     or has_table_privilege('anon','public.professional_waitlist_profiles','DELETE')
     or has_table_privilege('authenticated','public.professional_waitlist_profiles','SELECT')
     or has_table_privilege('authenticated','public.professional_waitlist_profiles','INSERT')
     or has_table_privilege('authenticated','public.professional_waitlist_profiles','UPDATE')
     or has_table_privilege('authenticated','public.professional_waitlist_profiles','DELETE') then
    raise exception 'Waitlist profile table must not be directly readable or writable';
  end if;
  if not has_function_privilege('anon',v_public_proc,'EXECUTE')
     or not has_function_privilege('authenticated',v_public_proc,'EXECUTE') then
    raise exception 'Public waitlist search RPC must be callable without login';
  end if;
  if has_function_privilege('anon',v_owner_proc,'EXECUTE')
     or not has_function_privilege('authenticated',v_owner_proc,'EXECUTE')
     or has_function_privilege('anon',v_my_proc,'EXECUTE')
     or not has_function_privilege('authenticated',v_my_proc,'EXECUTE') then
    raise exception 'Waitlist profile management RPC grants are too broad or missing';
  end if;
  select pg_get_function_result(v_public_proc) into v_result;
  if v_result not like '%status_label text%' or v_result not like '%average_stars numeric%'
     or v_result not like '%review_count bigint%' then
    raise exception 'Public waitlist search must expose the explicit status and verified review summary';
  end if;
  if v_result ilike '%phone%' or v_result ilike '%email%' or v_result ilike '%website%'
     or v_result ilike '%postcode%' or v_result ilike '%queue%' then
    raise exception 'Public waitlist result shape must not expose contact details or queue rank';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.professional_waitlist_profiles'::regclass
      and conname='waitlist_profile_contact_free'
  ) then
    raise exception 'Public applicant profile needs the contact-free database guard';
  end if;
end
$contract$;
