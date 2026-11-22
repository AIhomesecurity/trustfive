-- Private saved community posts. Bookmarks do not affect marketplace ranking,
-- professional verification, post visibility or other users' access.
begin;

create table public.social_saved_posts(
 user_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid not null references public.community_posts(id) on delete cascade,
 saved_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
create index social_saved_posts_lookup_idx
 on public.social_saved_posts(user_id,saved_at desc);

alter table public.social_saved_posts enable row level security;
-- Explicit revoke matters because old test bootstrap applies broad default ACLs.
revoke all on public.social_saved_posts from public,anon,authenticated;
grant select,insert,delete on public.social_saved_posts to authenticated;

create policy "members see only own saved posts" on public.social_saved_posts
 for select to authenticated using(user_id=(select auth.uid()));
create policy "members save genuinely published posts" on public.social_saved_posts
 for insert to authenticated with check(
  user_id=(select auth.uid()) and
  exists(select 1 from public.community_posts p
    where p.id=post_id and p.visibility='published')
 );
create policy "members remove own saved posts" on public.social_saved_posts
 for delete to authenticated using(user_id=(select auth.uid()));

create trigger quota_social_saved_posts before insert on public.social_saved_posts
 for each row execute function public.enforce_account_write_quota('save_community_post','100','day');

commit;
