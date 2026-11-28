-- Authenticated neighbourhood reactions with privacy-preserving aggregate read.
begin;
create table public.community_post_reactions(
 post_id uuid not null references public.community_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(reaction in ('like','support')),
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
alter table public.community_post_reactions enable row level security;
create policy "read only own reaction records" on public.community_post_reactions
 for select to authenticated using(user_id=(select auth.uid()));
create policy "react to published posts" on public.community_post_reactions
 for insert to authenticated with check(user_id=(select auth.uid()) and
  exists(select 1 from public.community_posts p where p.id=post_id and p.visibility='published'));
create policy "update your published post reactions" on public.community_post_reactions
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and exists(
  select 1 from public.community_posts p where p.id=post_id and p.visibility='published'));
create policy "remove own reactions" on public.community_post_reactions
 for delete to authenticated using(user_id=(select auth.uid()));

create or replace function public.community_reactions_for_posts(p_post_ids uuid[])
returns table(post_id uuid,likes bigint,supports bigint,my_reaction text)
language sql stable security definer set search_path=''
as $$
 select p.id,
   count(r.user_id) filter(where r.reaction='like')::bigint,
   count(r.user_id) filter(where r.reaction='support')::bigint,
   max(r.reaction) filter(where r.user_id=auth.uid())
 from public.community_posts p
 left join public.community_post_reactions r on r.post_id=p.id
 where p.id=any(p_post_ids) and p.visibility='published'
 group by p.id;
$$;
revoke all on function public.community_reactions_for_posts(uuid[]) from public,anon;
grant execute on function public.community_reactions_for_posts(uuid[]) to authenticated;
commit;