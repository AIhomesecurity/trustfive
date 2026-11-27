-- Rollback-only synthetic contract for public Social contact-sharing guards
-- across community_posts, community_comments, community_group_posts,
-- community_groups and community_events (migrations 0056 & 0060), while
-- explicitly preserving private booking conversations in quote_messages.
begin;

insert into auth.users(id, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111110060', '{"full_name":"Synthetic Social Author 60","requested_role":"customer"}'),
 ('22222222-2222-4222-8222-222222220060', '{"full_name":"Synthetic Booking Pro 60","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.trades(id, slug, name) values
 ('33333333-3333-4333-8333-333333330060', 'synthetic-contact-guard-trade', 'Synthetic Contact Guard Trade')
on conflict (id) do nothing;

insert into public.service_areas(id, country_code, region, city, area_name) values
 ('44444444-4444-4444-8444-444444440060', 'GB', 'North West', 'Manchester', 'Synthetic Social 60')
on conflict (id) do nothing;

-- Seed a private booking conversation (quote + booking) before switching to authenticated.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111110060', true);
insert into public.jobs(id, customer_id, trade_id, area_id, title, description, status) values
 ('a4000000-0000-4000-8000-000000000060', '11111111-1111-4111-8111-111111110060',
  '33333333-3333-4333-8333-333333330060', '44444444-4444-4444-8444-444444440060',
  'Synthetic private booking job', 'Synthetic job brief for private messaging check.', 'open');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222220060', true);
insert into public.job_quotes(id, job_id, professional_id, amount_pence, message, status) values
 ('a5000000-0000-4000-8000-000000000060', 'a4000000-0000-4000-8000-000000000060',
  '22222222-2222-4222-8222-222222220060', 18000,
  'Synthetic quote with full parts and labour included.', 'accepted');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111110060', true);
insert into public.job_bookings(id, quote_id, job_id, customer_id, professional_id, status) values
 ('a6000000-0000-4000-8000-000000000060', 'a5000000-0000-4000-8000-000000000060',
  'a4000000-0000-4000-8000-000000000060', '11111111-1111-4111-8111-111111110060',
  '22222222-2222-4222-8222-222222220060', 'booked');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111110060', true);

-- Clean public Social content succeeds.
insert into public.community_posts(id, author_id, area_id, body, visibility) values
 ('55555555-5555-4555-8555-555555600001', '11111111-1111-4111-8111-111111110060',
  '44444444-4444-4444-8444-444444440060',
  'Synthetic neighbourhood post with no contact details.', 'published');

insert into public.community_groups(id, area_id, creator_id, name, description, visibility) values
 ('66666666-6666-4666-8666-666666660060', '44444444-4444-4444-8444-444444440060',
  '11111111-1111-4111-8111-111111110060',
  'Synthetic gardeners 2026', '100 local neighbours sharing garden ideas and seasonal tool tips.', 'public');

insert into public.community_events(id, area_id, host_id, title, description, venue_label, starts_at, ends_at) values
 ('77777777-7777-4777-8777-777777770060', '44444444-4444-4444-8444-444444440060',
  '11111111-1111-4111-8111-111111110060',
  'Autumn park tidy 2026', '100 volunteers welcome for litter picking and bulb planting.',
  'Didsbury Park main gate', now() + interval '2 days', now() + interval '2 days 2 hours');

-- Public Social contact details (numeric, spelled-out, fullwidth, email, domain, postcode) must be blocked.
do $$
begin
 begin
  insert into public.community_posts(author_id, area_id, body, visibility) values
   ('11111111-1111-4111-8111-111111110060', '44444444-4444-4444-8444-444444440060',
    'Call zero seven one two three four five six seven eight nine', 'published');
  raise exception 'Spelled-out phone number was accepted in a public post';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_posts(author_id, area_id, body, visibility) values
   ('11111111-1111-4111-8111-111111110060', '44444444-4444-4444-8444-444444440060',
    'Visit SW1A 1AA for the address details', 'published');
  raise exception 'Full postcode was accepted in a public post';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_comments(post_id, author_id, body) values
   ('55555555-5555-4555-8555-555555600001', '11111111-1111-4111-8111-111111110060',
    'Text me on 07700 900123');
  raise exception 'Numeric phone number was accepted in a public reply';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_group_posts(group_id, author_id, body, visibility) values
   ('66666666-6666-4666-8666-666666660060', '11111111-1111-4111-8111-111111110060',
    'My mobile is ０７１２３ ４５６７８９', 'published');
  raise exception 'Fullwidth phone number was accepted in a member-visible group post';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_groups(area_id, creator_id, name, description, visibility) values
   ('44444444-4444-4444-8444-444444440060', '11111111-1111-4111-8111-111111110060',
    'Call me 07700 900123', 'A group for local garden ideas and help.', 'public');
  raise exception 'Phone number was accepted in a public group name';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_groups(area_id, creator_id, name, description, visibility) values
   ('44444444-4444-4444-8444-444444440060', '11111111-1111-4111-8111-111111110060',
    'Local trades club', 'Book cheap quotes directly at example-trades.co.uk today.', 'public');
  raise exception 'External website domain was accepted in a public group description';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_events(area_id, host_id, title, description, venue_label, starts_at, ends_at) values
   ('44444444-4444-4444-8444-444444440060', '11111111-1111-4111-8111-111111110060',
    'Local garden meetup', 'Share ideas and bring small tools.', 'Email events@example.test',
    now() + interval '2 days', now() + interval '2 days 1 hour');
  raise exception 'Email was accepted in a community event venue';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_events(area_id, host_id, title, description, venue_label, starts_at, ends_at) values
   ('44444444-4444-4444-8444-444444440060', '11111111-1111-4111-8111-111111110060',
    'Call 07700 900123 meetup', 'Share ideas and bring small tools.', 'Didsbury Park',
    now() + interval '2 days', now() + interval '2 days 1 hour');
  raise exception 'Phone number was accepted in a community event title';
 exception when check_violation then null;
 end;

 begin
  insert into public.community_events(area_id, host_id, title, description, venue_label, starts_at, ends_at) values
   ('44444444-4444-4444-8444-444444440060', '11111111-1111-4111-8111-111111110060',
    'Local tool swap', 'Drop round to M20 2WS with spare drills and hand saws.', 'Didsbury Park',
    now() + interval '2 days', now() + interval '2 days 1 hour');
  raise exception 'Full postcode was accepted in a community event description';
 exception when check_violation then null;
 end;
end $$;

-- Private booking conversations remain intentionally outside the public Social contact guard.
insert into public.quote_messages(quote_id, author_id, body) values
 ('a5000000-0000-4000-8000-000000000060', '11111111-1111-4111-8111-111111110060',
  'Booking confirmed: ring 07700 900123 on arrival near SW1A 1AA for gate entry.');

select 'Social public contact-sharing guard contract passed' as result;
rollback;
