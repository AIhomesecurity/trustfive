-- Real TrustFive Social group join, leave and member-post RLS contract.
-- Fully synthetic fixtures; no customer data; transaction always rolls back.
begin;

do $fixture$
declare area_id uuid;
begin
 insert into auth.users(id,raw_user_meta_data) values
  ('00000000-0000-0000-00e7-000000000001','{"full_name":"Synthetic Group Founder"}'),
  ('00000000-0000-0000-00e7-000000000002','{"full_name":"Synthetic Group Member"}'),
  ('00000000-0000-0000-00e7-000000000003','{"full_name":"Synthetic Group Outsider"}');
 insert into public.service_areas(country_code,city,area_name)
 values ('GB','Social Group Contract City','Synthetic Social Group Area')
 returning id into area_id;
 perform set_config('trustfive.sg_area',area_id::text,true);
end
$fixture$;

set role authenticated;
do $founder$
declare founder uuid:='00000000-0000-0000-00e7-000000000001';
 v_group_id uuid:='00000000-0000-0000-00e8-000000000001';
 post_id uuid:='00000000-0000-0000-00e9-000000000001';
begin
 perform set_config('request.jwt.claim.sub',founder::text,true);
 insert into public.community_groups(id,area_id,creator_id,name,description,visibility)
 values(v_group_id,current_setting('trustfive.sg_area')::uuid,founder,
  'Synthetic Group Conversations',
  'A real member-only group used for synthetic RLS contract tests.','public');
 if not exists(select 1 from public.community_group_memberships
  where group_id=v_group_id and user_id=founder and role='owner') then
  raise exception 'Group creator did not receive owner membership';
 end if;
 insert into public.community_group_posts(id,group_id,author_id,body,visibility)
 values(post_id,group_id,founder,
  'Founding group discussion visible only to genuine members.','published');
 if not exists(select 1 from public.community_group_posts where id=post_id) then
  raise exception 'Group founder cannot read own published post';
 end if;
 -- Founder membership must not be deletable through the member-only RLS rule.
 delete from public.community_group_memberships
  where user_id=founder and role='owner';
 if not exists(select 1 from public.community_group_memberships
  where user_id=founder and role='owner') then
  raise exception 'Founder could leave through member-only control';
 end if;
end
$founder$;
reset role;

set role anon;
do $anonymous$
begin
 if exists(select 1 from public.community_groups
  where id='00000000-0000-0000-00e8-000000000001')
  or exists(select 1 from public.community_group_posts
  where group_id='00000000-0000-0000-00e8-000000000001') then
  raise exception 'Anonymous caller read members-only Social group content';
 end if;
end
$anonymous$;
reset role;

set role authenticated;
do $outsider$
declare outsider uuid:='00000000-0000-0000-00e7-000000000003';
 v_group_id uuid:='00000000-0000-0000-00e8-000000000001';
begin
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 -- Public-to-members discovery is allowed, while group posts are not.
 if not exists(select 1 from public.community_groups where id=v_group_id) then
  raise exception 'Signed-in member cannot discover a public group';
 end if;
 if exists(select 1 from public.community_group_posts where group_id=v_group_id) then
  raise exception 'Nonmember read protected group conversation';
 end if;
 begin
  insert into public.community_group_posts(group_id,author_id,body)
  values(v_group_id,outsider,'A nonmember must not be able to post here.');
  raise exception 'SENTINEL: nonmember published to a group';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
 begin
  insert into public.community_group_memberships(group_id,user_id,role)
  values(v_group_id,outsider,'owner');
  raise exception 'SENTINEL: nonfounder forged owner membership';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$outsider$;

do $member$
declare member_id uuid:='00000000-0000-0000-00e7-000000000002';
 v_group_id uuid:='00000000-0000-0000-00e8-000000000001';
 post_id uuid:='00000000-0000-0000-00e9-000000000002';
begin
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 insert into public.community_group_memberships(group_id,user_id,role)
 values(v_group_id,member_id,'member');
 if not exists(select 1 from public.community_group_posts
  where group_id=v_group_id and id='00000000-0000-0000-00e9-000000000001') then
  raise exception 'New member cannot read published group discussion';
 end if;
 insert into public.community_group_posts(id,group_id,author_id,body)
 values(post_id,group_id,member_id,'This is a synthetic response by a real group member.');
 if not exists(select 1 from public.community_group_posts where id=post_id) then
  raise exception 'Group member cannot read their published response';
 end if;
 -- A member must not impersonate another user in a post.
 begin
  insert into public.community_group_posts(group_id,author_id,body)
  values(v_group_id,'00000000-0000-0000-00e7-000000000003',
   'This forged response must be rejected by database RLS.');
  raise exception 'SENTINEL: member forged another post author';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
 delete from public.community_group_memberships
 where group_id=v_group_id and user_id=member_id and role='member';
 if exists(select 1 from public.community_group_posts
  where group_id=v_group_id) then
  raise exception 'Former member retained access to protected group posts';
 end if;
end
$member$;
reset role;
rollback;
