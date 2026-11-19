-- Security hardening: the active-approval helper is an internal RLS/policy
-- predicate, not a public client API. Its SECURITY DEFINER privileges must not
-- be directly available through PostgREST to anonymous or signed-in clients.
-- Policy evaluation still runs through the table owner's expression.
begin;
revoke execute on function public.is_active_approved_application(uuid)
 from public, anon, authenticated;
-- The public directory functions are intentionally callable to display
-- approved, non-sensitive profiles; do not revoke them without redesigning
-- public search. Their outputs must remain audited for private data exposure.
commit;
