-- Community foundation: local posts, replies, reports and protected moderation.
begin;
create table public.community_posts(
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.service_areas(id),
  body text not null check(char_length(btrim(body)) between 8 and 3000),
  visibility text not null default 'published'
    check(visibility in ('published','hidden','removed')),
  created_at timestamptz not null default now()
);
create index community_posts_area_created_idx on public.community_posts(area_id,created_at desc);
alter table public.community_posts enable row level security;
create policy "members see published and own posts" on public.community_posts for select
to authenticated using(visibility='published' or author_id=(select auth.uid()));
create policy "members publish own posts" on public.community_posts for insert
to authenticated with check(author_id=(select auth.uid()) and visibility='published');

create table public.community_comments(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 2 and 1500),
  created_at timestamptz not null default now()
);
create index community_comments_post_created_idx on public.community_comments(post_id,created_at);
alter table public.community_comments enable row level security;
create policy "members see comments on published posts" on public.community_comments for select
to authenticated using(exists(select 1 from public.community_posts p
  where p.id=post_id and p.visibility='published'));
create policy "members comment on published posts" on public.community_comments for insert
to authenticated with check(author_id=(select auth.uid()) and exists(
  select 1 from public.community_posts p where p.id=post_id and p.visibility='published'
));

create table public.community_reports(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  category text not null check(category in ('spam','abuse','privacy','other')),
  explanation text check(length(explanation)<=1200),
  status text not null default 'pending'
    check(status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(post_id,reporter_id)
);
alter table public.community_reports enable row level security;
create policy "members create own post reports" on public.community_reports for insert
to authenticated with check(reporter_id=(select auth.uid()) and status='pending');
create policy "members see own post reports" on public.community_reports for select
to authenticated using(reporter_id=(select auth.uid()));
create policy "admins see reports" on public.community_reports for select
to authenticated using((select public.is_trustfive_admin()));

create or replace function public.moderate_community_post(p_post uuid,p_visibility text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_trustfive_admin() then
   raise exception 'Not authorised' using errcode='42501';
 end if;
 if p_visibility not in ('published','hidden','removed') then
   raise exception 'Invalid visibility';
 end if;
 update public.community_posts set visibility=p_visibility where id=p_post;
 if not found then raise exception 'Post not found'; end if;
 insert into public.network_audit_events(actor_id,action,detail)
   values(auth.uid(),'community_post_moderated',
      jsonb_build_object('post_id',p_post,'visibility',p_visibility));
end $$;
revoke all on function public.moderate_community_post(uuid,text) from public,anon;
grant execute on function public.moderate_community_post(uuid,text) to authenticated;
commit;