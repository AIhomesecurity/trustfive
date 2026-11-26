-- Rollback-only synthetic contract for Social public/member-visible contact guards.
begin;
insert into auth.users(id, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111110056', '{"full_name":"Synthetic Social Author 56","requested_role":"customer"}');
insert into public.service_areas(id,country_code,city,area_name) values
 ('44444444-4444-4444-8444-444444440056','GB','Manchester','Synthetic Social 56')
 on conflict(id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111110056',true);

insert into public.community_posts(id,author_id,area_id,body,visibility) values
 ('55555555-5555-4555-8555-555555560001','11111111-1111-4111-8111-111111110056','44444444-4444-4444-8444-444444440056',
  'Synthetic neighbourhood post with no contact details.','published');

do $$
begin
 begin
  insert into public.community_posts(author_id,area_id,body,visibility) values
   ('11111111-1111-4111-8111-111111110056','44444444-4444-4444-8444-444444440056',
    'Call zero seven one two three four five six seven eight nine','published');
  raise exception 'Spelled-out phone number was accepted in a public post';
 exception when check_violation then null;
 end;
 begin
  insert into public.community_posts(author_id,area_id,body,visibility) values
   ('11111111-1111-4111-8111-111111110056','44444444-4444-4444-8444-444444440056',
    'Visit SW1A 1AA for the address details','published');
  raise exception 'Full postcode was accepted in a public post';
 exception when check_violation then null;
 end;
 begin
  insert into public.community_comments(post_id,author_id,body) values
   ('55555555-5555-4555-8555-555555560001','11111111-1111-4111-8111-111111110056',
    'Text me on 07700 900123');
  raise exception 'Numeric phone number was accepted in a public reply';
 exception when check_violation then null;
 end;
end $$;

insert into public.community_groups(id,area_id,creator_id,name,description,visibility) values
 ('66666666-6666-4666-8666-666666660056','44444444-4444-4444-8444-444444440056',
  '11111111-1111-4111-8111-111111110056','Synthetic gardeners','A group for local garden ideas and help.','public');

do $$
begin
 begin
  insert into public.community_group_posts(group_id,author_id,body,visibility) values
   ('66666666-6666-4666-8666-666666660056','11111111-1111-4111-8111-111111110056',
    'My mobile is ０７１２３ ４５６７８９','published');
  raise exception 'Fullwidth phone number was accepted in a member-visible group post';
 exception when check_violation then null;
 end;
 begin
  insert into public.community_groups(area_id,creator_id,name,description,visibility) values
   ('44444444-4444-4444-8444-444444440056','11111111-1111-4111-8111-111111110056',
    'Call me 07700 900123','A group for local garden ideas and help.','public');
  raise exception 'Phone number was accepted in a public group name';
 exception when check_violation then null;
 end;
 begin
  insert into public.community_events(area_id,host_id,title,description,venue_label,starts_at,ends_at) values
   ('44444444-4444-4444-8444-444444440056','11111111-1111-4111-8111-111111110056',
    'Local garden meetup','Share ideas and bring small tools.','Email events@example.test',now()+interval '2 days',now()+interval '2 days 1 hour');
  raise exception 'Email was accepted in a community event';
 exception when check_violation then null;
 end;
end $$;

-- Private booking conversations are intentionally outside this public Social guard.
select 'Social public contact-sharing guard contract passed' as result;
rollback;
