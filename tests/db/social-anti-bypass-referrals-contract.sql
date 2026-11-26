-- Rollback-only PostgreSQL RLS and anti-bypass contract for migration 0056.
begin;

do $$
declare
  v_customer uuid := '11111111-1111-4111-8111-111111110056';
  v_pro_a uuid := '22222222-2222-4222-8222-222222220056';
  v_pro_b uuid := '33333333-3333-4333-8333-333333330056';
  v_area uuid := '44444444-4444-4444-8444-444444440056';
  v_trade uuid;
  v_post uuid := '55555555-5555-4555-8555-555555550056';
  v_group uuid := '66666666-6666-4666-8666-666666660056';
  v_unapproved_app uuid := '77777777-7777-4777-8777-777777770056';
  v_referral uuid;
  v_count integer;
begin
  insert into auth.users(id, raw_user_meta_data) values
    (v_customer, '{"full_name":"Synthetic Resident 56"}'::jsonb),
    (v_pro_a, '{"full_name":"Synthetic Installer A 56"}'::jsonb),
    (v_pro_b, '{"full_name":"Synthetic Installer B 56"}'::jsonb)
  on conflict (id) do nothing;

  insert into public.profiles(id, full_name) values
    (v_customer, 'Synthetic Resident 56'),
    (v_pro_a, 'Synthetic Installer A 56'),
    (v_pro_b, 'Synthetic Installer B 56')
  on conflict (id) do nothing;

  insert into public.service_areas(id, area_name, city, region, country_code)
  values (v_area, 'Didsbury Contract 56', 'Manchester', 'North West', 'GB')
  on conflict (id) do nothing;

  select id into v_trade from public.trades order by name limit 1;

  -- Register Pro A (eligible) and Pro B (pending, unapproved)
  insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, status)
  values
    (gen_random_uuid(), v_pro_a, v_trade, v_area, 'Synthetic Pro A Ltd', 'eligible'),
    (v_unapproved_app, v_pro_b, v_trade, v_area, 'Synthetic Pro B Pending', 'pending');

  -- Clean post by resident succeeds
  perform set_config('request.jwt.claim.sub', v_customer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  insert into public.community_posts(id, author_id, area_id, body, visibility)
  values (v_post, v_customer, v_area, 'Can anyone recommend a local approved security engineer in Didsbury?', 'published');

  -- 1. Phone numbers, websites, emails and full postcodes MUST be rejected on community_posts
  begin
    insert into public.community_posts(author_id, area_id, body)
    values (v_customer, v_area, 'Call me direct on 07700 900123 for a quick quote.');
    raise exception 'SENTINEL: phone number bypassed community_posts check';
  exception when check_violation then null;
  end;

  begin
    insert into public.community_posts(author_id, area_id, body)
    values (v_customer, v_area, 'Check out my website https://example-trades.co.uk for deals.');
    raise exception 'SENTINEL: website URL bypassed community_posts check';
  exception when check_violation then null;
  end;

  begin
    insert into public.community_posts(author_id, area_id, body)
    values (v_customer, v_area, 'Visit myplumbing.co.uk or email bob@trade.co.uk directly.');
    raise exception 'SENTINEL: bare domain/email bypassed community_posts check';
  exception when check_violation then null;
  end;

  begin
    insert into public.community_posts(author_id, area_id, body)
    values (v_customer, v_area, 'Pop round to M20 2WS anytime tomorrow morning.');
    raise exception 'SENTINEL: full postcode bypassed community_posts check';
  exception when check_violation then null;
  end;

  -- 2. Same anti-bypass check MUST reject contact/links on community_comments
  begin
    insert into public.community_comments(post_id, author_id, body)
    values (v_post, v_customer, 'Message me on whatsapp 07700 900456 instead.');
    raise exception 'SENTINEL: whatsapp/phone bypassed community_comments check';
  exception when check_violation then null;
  end;

  insert into public.community_comments(post_id, author_id, body)
  values (v_post, v_customer, 'Use the TrustFive jobs form so approved local pros can quote fairly.');

  -- 3. Same anti-bypass check MUST reject links on community_group_posts
  reset role;
  insert into public.community_groups(id, name, description, area_id, creator_id, visibility)
  values (v_group, 'Didsbury Group 56', 'Local group for anti-bypass contract check.', v_area, v_customer, 'public');
  insert into public.community_group_memberships(group_id, user_id, role)
  values (v_group, v_customer, 'owner')
  on conflict do nothing;

  perform set_config('request.jwt.claim.sub', v_customer::text, true);
  set local role authenticated;
  begin
    insert into public.community_group_posts(group_id, author_id, body)
    values (v_group, v_customer, 'Book directly at www.cheap-installers.com today!');
    raise exception 'SENTINEL: website bypassed community_group_posts check';
  exception when check_violation then null;
  end;

  -- 4. Non-professional customer CANNOT create or browse social_trade_referrals
  begin
    insert into public.social_trade_referrals(referrer_id, target_trade_id, area_id, summary)
    values (v_customer, v_trade, v_area, 'Homeowner needs approved local electrician for kitchen lights.');
    raise exception 'SENTINEL: non-professional created trade referral';
  exception when insufficient_privilege then null;
  end;

  -- 5. Anonymous CANNOT access social_trade_referrals
  reset role;
  set local role anon;
  begin
    perform count(*) from public.social_trade_referrals;
    raise exception 'SENTINEL: anon read social_trade_referrals';
  exception when insufficient_privilege then null;
  end;

  -- 6. Registered professional A creates valid zero-PII trade referral
  reset role;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  set local role authenticated;

  -- Reject referral containing phone number or customer address
  begin
    insert into public.social_trade_referrals(referrer_id, target_trade_id, area_id, summary)
    values (v_pro_a, v_trade, v_area, 'Customer at M20 2WS call 07700 900111 for boiler swap.');
    raise exception 'SENTINEL: customer PII bypassed social_trade_referrals check';
  exception when check_violation then null;
  end;

  -- Reject recommending an unapproved pending professional
  begin
    insert into public.social_trade_referrals(
      referrer_id, target_trade_id, area_id, recommended_application_id, summary
    )
    values (
      v_pro_a, v_trade, v_area, v_unapproved_app,
      'Homeowner finishing bathroom remodel needs an approved local electrician next week.'
    );
    raise exception 'SENTINEL: unapproved professional recommended in referral';
  exception when insufficient_privilege then null;
  end;

  -- Reject excessive percentage split (> 10% referrer or > 5% platform)
  begin
    insert into public.social_trade_referrals(
      referrer_id, target_trade_id, area_id, summary, referrer_share_bps, platform_share_bps
    )
    values (
      v_pro_a, v_trade, v_area,
      'Homeowner finishing bathroom remodel needs an approved local electrician next week.',
      1500, 300
    );
    raise exception 'SENTINEL: excessive referrer share bypassed check';
  exception when check_violation then null;
  end;

  -- Valid zero-PII referral succeeds with server-generated TF- code & pilot_ledger_only
  insert into public.social_trade_referrals(
    referrer_id, target_trade_id, area_id, summary, referrer_share_bps, platform_share_bps
  )
  values (
    v_pro_a, v_trade, v_area,
    'Homeowner completing a garden office build needs an approved local CCTV engineer next month.',
    500, 300
  )
  returning id into v_referral;

  -- Pro B (registered professional) can browse open referrals in the trade network
  reset role;
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  set local role authenticated;
  select count(*) into v_count from public.social_trade_referrals where id = v_referral;
  if v_count <> 1 then
    raise exception 'Registered professional could not see open trade referral';
  end if;

  -- Pro B CANNOT close Pro A's referral
  update public.social_trade_referrals set status = 'closed' where id = v_referral;
  reset role;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  set local role authenticated;
  select count(*) into v_count from public.social_trade_referrals where id = v_referral and status = 'open';
  if v_count <> 1 then
    raise exception 'Other professional closed referrer trade referral';
  end if;

  -- Pro A closes own referral
  update public.social_trade_referrals set status = 'closed' where id = v_referral;
  select count(*) into v_count from public.social_trade_referrals where id = v_referral and status = 'closed';
  if v_count <> 1 then
    raise exception 'Referrer could not close own trade referral';
  end if;

  reset role;
end $$;

rollback;
