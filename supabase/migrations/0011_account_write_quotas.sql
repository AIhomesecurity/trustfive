-- Per-account database quotas limit spam even when users bypass the UI.
-- This complements, but does not replace, edge/IP throttling and fraud checks.
begin;
create table public.account_write_quotas(
 user_id uuid not null references public.profiles(id) on delete cascade,
 action text not null,
 window_start timestamptz not null,
 uses integer not null default 0 check(uses>=0),
 primary key(user_id,action,window_start)
);
alter table public.account_write_quotas enable row level security;
revoke all on public.account_write_quotas from anon,authenticated;

create or replace function public.enforce_account_write_quota()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_account uuid;v_max integer;v_current integer;v_window timestamptz;
begin
 v_account=auth.uid();
 if v_account is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if tg_nargs<>3 then raise exception 'Invalid rate-limiter configuration'; end if;
 v_max=tg_argv[1]::integer;
 if v_max<1 or v_max>1000 then raise exception 'Invalid rate limit'; end if;
 if tg_argv[2]='hour' then
  v_window=date_trunc('hour',clock_timestamp());
 elsif tg_argv[2]='day' then
  v_window=date_trunc('day',clock_timestamp());
 else
  raise exception 'Invalid rate limit window';
 end if;
 insert into public.account_write_quotas(user_id,action,window_start,uses)
 values(v_account,tg_argv[0],v_window,1)
 on conflict(user_id,action,window_start)
 do update set uses=public.account_write_quotas.uses+1
 returning uses into v_current;
 if v_current>v_max then
  raise exception 'Posting limit reached. Please try again later.' using errcode='P0001';
 end if;
 return new;
end $$;
revoke all on function public.enforce_account_write_quota() from public,anon,authenticated;

create trigger quota_neighbourhood_posts before insert on public.community_posts
for each row execute function public.enforce_account_write_quota('community_post','12','hour');
create trigger quota_neighbourhood_comments before insert on public.community_comments
for each row execute function public.enforce_account_write_quota('community_comment','40','hour');
create trigger quota_group_creation before insert on public.community_groups
for each row execute function public.enforce_account_write_quota('create_group','3','day');
create trigger quota_group_posts before insert on public.community_group_posts
for each row execute function public.enforce_account_write_quota('group_post','20','hour');
create trigger quota_local_events before insert on public.community_events
for each row execute function public.enforce_account_write_quota('create_event','5','day');
create trigger quota_job_requests before insert on public.jobs
for each row execute function public.enforce_account_write_quota('post_job','6','hour');
create trigger quota_quotes before insert on public.job_quotes
for each row execute function public.enforce_account_write_quota('new_quote','30','day');
create trigger quota_quote_messages before insert on public.quote_messages
for each row execute function public.enforce_account_write_quota('send_message','80','hour');

commit;