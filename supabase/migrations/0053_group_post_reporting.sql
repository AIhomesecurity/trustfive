begin;

create table public.community_group_post_reports (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_group_posts(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id),
 category text not null check (category in ('spam','abuse','privacy','other')),
 explanation text check (char_length(explanation) <= 1200),
 status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 unique (post_id, reporter_id)
);

alter table public.community_group_post_reports enable row level security;
revoke all on public.community_group_post_reports from public, anon, authenticated;
grant insert (post_id, reporter_id, category, explanation)
 on public.community_group_post_reports to authenticated;
create index community_group_post_reports_pending_idx
 on public.community_group_post_reports(created_at,id) where status='pending';

create policy "members report other published posts in their group"
 on public.community_group_post_reports for insert to authenticated
 with check (
  reporter_id = (select auth.uid()) and status = 'pending'
  and exists (
   select 1 from public.community_group_posts as post
   join public.community_group_memberships as membership on membership.group_id = post.group_id
   where post.id = community_group_post_reports.post_id
    and post.visibility = 'published'
    and post.author_id <> (select auth.uid())
    and membership.user_id = (select auth.uid())
  )
 );

create function public.pending_group_post_reports()
returns table (id uuid, category text, explanation text, created_at timestamptz, post_body text)
language plpgsql stable security definer set search_path = ''
as $$
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode = '42501';
 end if;
 return query
 select report.id, report.category, report.explanation, report.created_at, post.body
 from public.community_group_post_reports as report
 join public.community_group_posts as post on post.id = report.post_id
 where report.status = 'pending'
 order by report.created_at, report.id
 limit 50;
end $$;

create function public.moderate_group_post_report(p_report uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_post uuid;
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode = '42501';
 end if;
 if p_action is null or p_action not in ('hide','dismiss') then
  raise exception 'Invalid report action' using errcode = '22023';
 end if;
 update public.community_group_post_reports
 set status = case p_action when 'hide' then 'reviewed' else 'dismissed' end
 where id = p_report and status = 'pending'
 returning post_id into v_post;
 if not found then
  raise exception 'Report no longer pending' using errcode = 'P0002';
 end if;
 if p_action = 'hide' then
  update public.community_group_posts set visibility = 'hidden' where id = v_post;
 end if;
 insert into public.network_audit_events(actor_id,action,detail)
 values(auth.uid(),'community_group_post_report_resolved',
  jsonb_build_object('report_id',p_report,'post_id',v_post,'decision',p_action));
end $$;

revoke all on function public.pending_group_post_reports() from public, anon, authenticated;
revoke all on function public.moderate_group_post_report(uuid,text) from public, anon, authenticated;
grant execute on function public.pending_group_post_reports() to authenticated;
grant execute on function public.moderate_group_post_report(uuid,text) to authenticated;

commit;
