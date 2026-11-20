-- Read-only public directory security contract. No fixture or data mutation.
-- Execute with psql -v ON_ERROR_STOP=1 -f tests/sql/public-directory-security-contract.sql
DO $audit$
DECLARE f record; definition text; exposed text[];
BEGIN
  FOR f IN SELECT p.oid,p.proname,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('find_trustfive_professionals','find_trustfive_professionals_with_reviews',
       'find_trustfive_professionals_nearby','is_active_approved_application')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(f.proconfig,ARRAY[]::text[])) config
      WHERE config IN ('search_path=','search_path=""')
    ) THEN RAISE EXCEPTION 'Unsafe search_path: %',f.proname; END IF;
    definition:=lower(pg_get_functiondef(f.oid));
    IF definition NOT LIKE '%security definer%'
       OR definition NOT LIKE '%active_allocations%'
       OR definition NOT LIKE '%verification_state%'
    THEN RAISE EXCEPTION 'Missing security/verification gate: %',f.proname; END IF;
    IF f.proname='find_trustfive_professionals_nearby'
       AND (definition NOT LIKE '%service_radius_km%'
            OR definition NOT LIKE '%professional_service_locations%')
    THEN RAISE EXCEPTION 'Nearby directory missing verified radius gate'; END IF;
    IF f.proname LIKE 'find_trustfive_professionals%' THEN
      SELECT array_agg(lower(pn)) INTO exposed
      FROM pg_proc p,unnest(p.proargnames,p.proargmodes) AS o(pn,mode)
      WHERE p.oid=f.oid AND mode IN ('o','b','t');
      -- Positive allowlist: adding a sensitive field must fail even when its
      -- name is not present in a hand-maintained denylist.
      IF exposed IS NULL OR NOT (exposed <@ ARRAY[
        'application_id','business_name','about','trade_name','area_name',
        'city','country_code','quality_score','slot','average_stars',
        'review_count','distance_km'
      ]::text[])
      THEN RAISE EXCEPTION 'Unexpected directory output: % (%)',f.proname,exposed; END IF;
      IF NOT (ARRAY['application_id','business_name','trade_name','slot']::text[] <@ exposed)
      THEN RAISE EXCEPTION 'Missing essential directory fields: %',f.proname; END IF;
      IF f.proname='find_trustfive_professionals_nearby'
         AND NOT ('distance_km'=ANY(exposed))
      THEN RAISE EXCEPTION 'Nearby directory must return distance'; END IF;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
      ('find_trustfive_professionals','find_trustfive_professionals_with_reviews',
       'find_trustfive_professionals_nearby','is_active_approved_application'))<>4
  THEN RAISE EXCEPTION 'Expected four directory functions'; END IF;
END $audit$;

-- The approval helper is deliberately callable by anonymous visitors because
-- PostgreSQL evaluates EXECUTE privileges for public business-page RLS.
-- Do not blindly revoke it to silence the advisor: that would break SELECT.
-- Instead pin its boolean-only signature and the published+vetted RLS gate.
DO $approval_policy$
DECLARE helper oid;
BEGIN
  SELECT p.oid INTO STRICT helper
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='is_active_approved_application'
    AND pg_get_function_identity_arguments(p.oid)='p_application uuid';
  IF (SELECT prorettype FROM pg_proc WHERE oid=helper) <> 'boolean'::regtype
  THEN RAISE EXCEPTION 'Approval helper must return boolean only'; END IF;
  IF NOT has_function_privilege('anon',helper,'EXECUTE')
     OR NOT has_function_privilege('authenticated',helper,'EXECUTE')
  THEN RAISE EXCEPTION 'Public business-page RLS requires helper EXECUTE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='professional_business_pages'
      AND cmd='SELECT' AND roles @> ARRAY['anon','authenticated']::name[]
      AND qual LIKE '%is_active_approved_application(application_id)%'
      AND qual LIKE '%published%'
  ) THEN RAISE EXCEPTION 'Public business-page vetting policy missing'; END IF;
END $approval_policy$;

-- RLS policies are permissive (OR-combined). A second anonymous SELECT
-- policy can silently bypass the verified/published rule above. Guard the
-- entire anonymous policy surface, while leaving owner/admin policies intact.
DO $public_visibility$
DECLARE public_policy_count integer;
BEGIN
  SELECT count(*) INTO public_policy_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='professional_business_pages'
    AND cmd IN ('SELECT','ALL')
    AND ('anon'=ANY(roles) OR 'public'=ANY(roles));
  IF public_policy_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected anonymous business-page SELECT policy count: %',public_policy_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='professional_business_pages'
      AND cmd IN ('SELECT','ALL')
      AND ('anon'=ANY(roles) OR 'public'=ANY(roles))
      AND (qual IS NULL OR qual NOT LIKE '%is_active_approved_application(application_id)%'
           OR qual NOT LIKE '%published%')
  ) THEN RAISE EXCEPTION 'Anonymous business-page policy bypasses published/verified gate'; END IF;
  IF public.is_active_approved_application(NULL::uuid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'NULL application must never pass public approval gate'; END IF;
END $public_visibility$;
