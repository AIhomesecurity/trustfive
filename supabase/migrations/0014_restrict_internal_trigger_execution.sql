-- Restrict internal trigger helpers so they cannot be invoked as public RPCs.
-- Trigger/event-trigger invocation itself remains handled by PostgreSQL.
-- This migration deliberately does not modify end-user RPC permissions.
begin;
revoke execute on function public.add_group_creator() from public, anon, authenticated;
revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.emit_booking_notification() from public, anon, authenticated;
revoke execute on function public.emit_message_notification() from public, anon, authenticated;
revoke execute on function public.emit_quote_notification() from public, anon, authenticated;
revoke execute on function public.emit_vacancy_notification() from public, anon, authenticated;
revoke execute on function public.enforce_account_write_quota() from public, anon, authenticated;
revoke execute on function public.guard_active_allocation() from public, anon, authenticated;
-- Supabase-hosted projects may provide this event trigger; bare CI PostgreSQL does not.
do $
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$;
commit;
