-- Rollback-only saved-post privacy contract with synthetic identities.
begin;
do $fixtures$
declare v_area uuid;
begin
 insert into auth.users(id,raw_user_meta_data) values
  ('00000000-0000-0000-00f5-000000000001','{"full_name":"Synthetic Author"}'),
  ('00000000-0000-0000-00f5-000000000002','{"full_name":"Synthetic Saver"}'),
  ('00000000-0000-0000-00f5-000000000003','{"full_name":"Synthetic Outsider"}');
 insert into public.service_areas(country_code,city,area_name)
 values ('GB','Saved Tests Town','Saved Tests Area') returning id into v_area;
 insert into public.community_posts(id,author_id,area_id,body,visibility) values
  ('00000000-0000-0000-00f6-000000000001',
   '00000000-0000-0000-00f5-000000000001',v_area,
   'Public post to bookmark in the saved-post security contract.','published'),
  ('00000000-0000-0000-00f6-000000000002',
   '00000000-0000-0000-00f5-000000000001',v_area,
   'A hidden post that cannot be newly saved by other members.','hidden');
 if has_table_privilege('anon','public.social_saved_posts','SELECT')
  or has_table_privilege('anon','public.social_saved_posts','INSERT')
  or has_table_privilege('authenticated','public.social_saved_posts','UPDATE') then
  raise exception 'Saved post table has excessive privileges';
 end if;
end
$fixtures$;

set role authenticated;
do $saver$
declare v_user uuid:='00000000-0000-0000-00f5-000000000002';
 v_post uuid:='00000000-0000-0000-00f6-000000000001';
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.social_saved_posts(user_id,post_id) values(v_user,v_post);
 if not exists(select 1 from public.social_saved_posts where user_id=v_user and post_id=v_post) then
  raise exception 'Saver cannot read own saved post';
 end if;
 begin
  insert into public.social_saved_posts(user_id,post_id)
  values(v_user,'00000000-0000-0000-00f6-000000000002');
  raise exception 'SENTINEL: member saved hidden post';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
 begin
  insert into public.social_saved_posts(user_id,post_id)
  values('00000000-0000-0000-00f5-000000000003',v_post);
  raise exception 'SENTINEL: member impersonated another saver';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$saver$;

do $outsider$
declare v_user uuid:='00000000-0000-0000-00f5-000000000003';
 v_post uuid:='00000000-0000-0000-00f6-000000000001';
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if exists(select 1 from public.social_saved_posts where post_id=v_post) then
  raise exception 'Outsider read another person''s private saved posts';
 end if;
 delete from public.social_saved_posts where post_id=v_post;
 if not exists (select 1 from public.community_posts where id=v_post) then
  raise exception 'Unrelated post disappeared';
 end if;
end
$outsider$;

do $owner_remove$
declare v_user uuid:='00000000-0000-0000-00f5-000000000002';
 v_post uuid:='00000000-0000-0000-00f6-000000000001';
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if not exists(select 1 from public.social_saved_posts where user_id=v_user and post_id=v_post) then
  raise exception 'Outsider unexpectedly deleted another user''s saved post';
 end if;
 delete from public.social_saved_posts where user_id=v_user and post_id=v_post;
 if exists(select 1 from public.social_saved_posts where user_id=v_user and post_id=v_post) then
  raise exception 'Owner could not remove saved post';
 end if;
end
$owner_remove$;
reset role;
rollback;
