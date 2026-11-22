begin;

alter policy "group members read approved posts" on public.community_group_posts
 using (
  (visibility = 'published' or author_id = (select auth.uid()))
  and exists (
   select 1
   from public.community_group_memberships as membership
   where membership.group_id = community_group_posts.group_id
    and membership.user_id = (select auth.uid())
  )
 );

alter policy "group members publish their posts" on public.community_group_posts
 with check (
  author_id = (select auth.uid()) and visibility = 'published'
  and exists (
   select 1
   from public.community_group_memberships as membership
   where membership.group_id = community_group_posts.group_id
    and membership.user_id = (select auth.uid())
  )
 );

commit;
