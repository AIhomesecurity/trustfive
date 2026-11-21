-- The active-approval helper is referenced by a public RLS policy.
-- PostgreSQL evaluates policy function privileges for the querying role;
-- revoking EXECUTE breaks public business-page SELECT with SQLSTATE 42501.
-- Keep the narrow boolean helper executable, while ensuring it returns
-- only active approval status and does not expose application details.
begin;
grant execute on function public.is_active_approved_application(uuid)
 to anon, authenticated;
commit;
