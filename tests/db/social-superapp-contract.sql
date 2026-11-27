-- Rollback-only PostgreSQL security contract for Migration 0058:
-- Verifies strict authenticated-only RLS, anti-bypass contact_free checks,
-- no self-endorsements, no self-connections, and 1-vote-per-member polls.

begin;

do $$
declare
  v_user_a  uuid := 'aaaaaaaa-0058-4000-8000-000000000001';
  v_user_b  uuid := 'aaaaaaaa-0058-4000-8000-000000000002';
  v_area_id uuid;
  v_poll_id uuid;
  v_conn_id uuid;
  v_list_id uuid;
  v_blocked boolean;
  v_count   integer;
  v_votes   bigint;
  v_my_vote integer;
begin
  insert into auth.users (id) values (v_user_a), (v_user_b) on conflict (id) do nothing;
  select id into v_area_id from public.service_areas limit 1;
  if v_area_id is null then
    insert into public.service_areas (area_name, city, region, postcode_prefix, country_code)
    values ('Didsbury', 'Manchester', 'North West', 'M20', 'GB')
    returning id into v_area_id;
  end if;

  -- 1. Anon must be denied across all 6 new tables
  execute 'set local role anon';
  v_blocked := false;
  begin
    perform count(*) from public.social_member_profiles;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected anon denied on social_member_profiles'; end if;

  v_blocked := false;
  begin
    perform count(*) from public.social_polls;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected anon denied on social_polls'; end if;

  v_blocked := false;
  begin
    perform count(*) from public.social_local_listings;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected anon denied on social_local_listings'; end if;
  execute 'reset role';

  -- 2. User A creates profile; phone/URL in headline must be blocked by contact_free
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);

  v_blocked := false;
  begin
    insert into public.social_member_profiles (user_id, display_name, headline)
    values (v_user_a, 'Gary Engineer', 'Call 07700 900123 or visit mytrade.co.uk');
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected phone/URL headline to be blocked'; end if;

  insert into public.social_member_profiles (
    user_id, display_name, headline, about, area_id, skills, offers_summary, looking_for_summary, open_to_work, open_to_referrals
  ) values (
    v_user_a, 'Gary Engineer', 'CCTV & Network Specialist', 'Experienced UK installer sharing practical tips.',
    v_area_id, array['CCTV Installation', 'Cat6 Cabling'], '4K PoE CCTV & network troubleshooting', 'Trusted local electricians for job swaps', true, true
  );

  -- 3. Self-endorsement & self-connection must be rejected
  v_blocked := false;
  begin
    insert into public.social_skill_endorsements (member_id, endorser_id, skill)
    values (v_user_a, v_user_a, 'CCTV Installation');
  exception when insufficient_privilege or check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected self-endorsement to be blocked'; end if;

  -- 4. User A creates a poll, votes once, and creates a clean surplus materials listing (contact-free enforced)
  insert into public.social_polls (author_id, area_id, question, options)
  values (v_user_a, v_area_id, 'Which seasonal home check is top of your list this month?', '["Boiler service","Gutter clear","Security cameras"]'::jsonb)
  returning id into v_poll_id;

  insert into public.social_poll_votes (poll_id, voter_id, option_index) values (v_poll_id, v_user_a, 2);

  v_blocked := false;
  begin
    insert into public.social_local_listings (seller_id, area_id, category, title, description, price_pence)
    values (v_user_a, v_area_id, 'tools_materials', 'Spare Cat6 drum', 'Ring 07700 900123 to collect from M20 2WS', 2500);
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected off-platform contact details in local listing to be blocked'; end if;

  insert into public.social_local_listings (seller_id, area_id, category, title, description, price_pence)
  values (v_user_a, v_area_id, 'tools_materials', 'Half reel external Cat6 cable', 'Unused external-grade copper Cat6 cable left over from a clean install in Didsbury.', 2500)
  returning id into v_list_id;

  -- 5. User B connects with User A, endorses User A skill, votes on poll, and cannot tamper with User A listing
  perform set_config('request.jwt.claim.sub', v_user_b::text, true);

  insert into public.social_connections (requester_id, addressee_id, intro_note)
  values (v_user_b, v_user_a, 'Local electrician in Didsbury happy to swap referrals.')
  returning id into v_conn_id;

  insert into public.social_skill_endorsements (member_id, endorser_id, skill)
  values (v_user_a, v_user_b, 'CCTV Installation');

  insert into public.social_poll_votes (poll_id, voter_id, option_index) values (v_poll_id, v_user_b, 0);

  update public.social_local_listings set status = 'sold' where id = v_list_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'User B must NOT update User A local listing'; end if;

  -- 6. User A accepts User B connection
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  update public.social_connections set status = 'accepted' where id = v_conn_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'User A should be able to accept connection request'; end if;

  -- 7. A member can see their own raw vote; aggregate results expose no other voter identity or choice.
  select count(*) into v_count
  from public.social_poll_votes
  where poll_id = v_poll_id;
  if v_count <> 1 then raise exception 'Raw vote reads must expose only the caller own vote'; end if;

  select total_votes, my_option_index into v_votes, v_my_vote
  from public.social_poll_summary(array[v_poll_id])
  where poll_id = v_poll_id;
  if v_votes <> 2 or v_my_vote <> 2 then
    raise exception 'Poll summary should expose two aggregate votes and only the caller own selection';
  end if;

  -- 8. Contact details in an option or profile skill are rejected by database triggers.
  v_blocked := false;
  begin
    insert into public.social_polls (author_id, area_id, question, options)
    values (v_user_a, v_area_id, 'Which local service do you recommend?', '["CCTV","Call 07700 900123"]'::jsonb);
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected poll option contact details to be blocked'; end if;

  v_blocked := false;
  begin
    update public.social_member_profiles
    set skills = array['Call 07700 900123']
    where user_id = v_user_a;
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Expected contact details in profile skills to be blocked'; end if;

  -- 9. Poll content cannot be rewritten through the close-only update permission.
  v_blocked := false;
  begin
    update public.social_polls
    set options = '["Changed","Options"]'::jsonb
    where id = v_poll_id;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Poll authors must not update poll options'; end if;

  update public.social_polls set status = 'closed' where id = v_poll_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Poll author should be able to close their open poll'; end if;

  update public.social_polls set status = 'open' where id = v_poll_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Closed polls must not be reopened through the client'; end if;

  execute 'reset role';
end
$$;

rollback;
