-- P0 privacy and abuse-handling contract for community moderation, reports,
-- event responses and notification navigation hints. All fixtures live in one
-- transaction and are rolled back, so this file is safe in any CI order.
begin;

-- Isolated users, area and admin grant.
do $fixture$
declare
  v_admin uuid := '00000000-0000-0000-00c0-000000000004'::uuid;
  v_area uuid;
begin
  insert into auth.users(id,raw_user_meta_data) values
   ('00000000-0000-0000-00c0-000000000001','{"full_name":"Audit Post Author","requested_role":"customer"}'),
   ('00000000-0000-0000-00c0-000000000002','{"full_name":"Audit Reader","requested_role":"customer"}'),
   ('00000000-0000-0000-00c0-000000000003','{"full_name":"Audit Group Host","requested_role":"customer"}'),
   (v_admin,'{"full_name":"Audit Moderator","requested_role":"customer"}');
  insert into public.platform_admins(user_id) values (v_admin);
  insert into public.service_areas(country_code,city,area_name)
  values ('GB','Community Audit City','Community Audit Area') returning id into v_area;
  perform set_config('trustfive.cm_area',v_area::text,true);
end
$fixture$;

-- Authenticated fixtures, each under the owning user's real RLS claim.
set role authenticated;
do $posts$
declare v_author uuid := '00000000-0000-0000-00c0-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  insert into public.community_posts(id,author_id,area_id,body,visibility)
  values ('00000000-0000-0000-00c1-000000000001',v_author,
          current_setting('trustfive.cm_area')::uuid,
          'A published neighbourhood post used for the moderation audit.','published');
end
$posts$;

do $groups$
declare
  v_host uuid := '00000000-0000-0000-00c0-000000000003'::uuid;
  v_group uuid := '00000000-0000-0000-00c4-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  insert into public.community_groups(id,area_id,creator_id,name,description,visibility)
  values (v_group,current_setting('trustfive.cm_area')::uuid,v_host,
          'Audit Neighbourhood Group','A genuinely described local group for moderation tests.','public');
  insert into public.community_group_posts(id,group_id,author_id,body,visibility)
  values ('00000000-0000-0000-00c5-000000000001',v_group,v_host,
          'A published group post used for the membership audit.','published');
  insert into public.community_events(id,area_id,group_id,host_id,title,description,venue_label,starts_at,ends_at,visibility)
  values ('00000000-0000-0000-00c6-000000000001',
          current_setting('trustfive.cm_area')::uuid,v_group,v_host,
          'Audit Local Event','A fully described future neighbourhood event for response tests.',
          'Audit Community Hall',now()+interval '2 days',now()+interval '3 days','published');
end
$groups$;

do $reader_fixtures$
declare
  v_reader uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
  v_post uuid := '00000000-0000-0000-00c1-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_reader::text,true);
  insert into public.community_comments(id,post_id,author_id,body)
  values ('00000000-0000-0000-00c2-000000000001',v_post,v_reader,
          'A comment on the published neighbourhood post.');
  insert into public.community_reports(id,post_id,reporter_id,category,explanation,status)
  values ('00000000-0000-0000-00c3-000000000001',v_post,v_reader,'spam',
          'This post looks like automated spam and should be reviewed.', 'pending');
  insert into public.community_post_reactions(post_id,user_id,reaction)
  values (v_post,v_reader,'like');
  -- Positive control for the later hidden-post aggregate assertion.
  if (select likes from public.community_reactions_for_posts(array[v_post]::uuid[]) limit 1)<>1 then
    raise exception 'Published post reaction was not counted';
  end if;
end
$reader_fixtures$;
reset role;

-- Notification fixture: only the server/definer path may write these rows.
do $notification$
begin
  insert into public.account_notifications(id,recipient_id,kind,title,body,target_path)
  values ('00000000-0000-0000-00c7-000000000001',
          '00000000-0000-0000-00c0-000000000002'::uuid,'new_message',
          'Audit message','A private message notification for the audit reader.',
          '/messages?quote=00000000-0000-0000-00c8-000000000001');
end
$notification$;

-- 1. Anonymous visitors see no private community or notification records.
set role anon;
do $anon_rls$
declare
  v_post uuid := '00000000-0000-0000-00c1-000000000001'::uuid;
  v_group uuid := '00000000-0000-0000-00c4-000000000001'::uuid;
begin
  if exists (select 1 from public.community_posts where id=v_post)
     or exists (select 1 from public.community_reports)
     or exists (select 1 from public.community_group_posts where group_id=v_group)
     or exists (select 1 from public.community_events)
     or exists (select 1 from public.community_event_rsvps)
     or exists (select 1 from public.account_notifications) then
    raise exception 'Anonymous caller read private community or notification data';
  end if;
end
$anon_rls$;
reset role;

-- 2. Signed-in non-parties cannot see other users' reports, RSVPs or notices.
set role authenticated;
do $outsider_rls$
declare
  v_outside uuid := '00000000-0000-0000-00c0-000000000003'::uuid;
  v_note uuid := '00000000-0000-0000-00c7-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_outside::text,true);
  if exists (select 1 from public.community_reports) then
    raise exception 'A non-admin read another user''s abuse report';
  end if;
  if exists (select 1 from public.account_notifications where id=v_note) then
    raise exception 'A user read another user''s notification';
  end if;
  -- No UPDATE policy exists, so RLS silently matches zero rows.
  update public.community_reports set status='reviewed'
  where id='00000000-0000-0000-00c3-000000000001'::uuid;
  if exists (select 1 from public.community_reports
             where id='00000000-0000-0000-00c3-000000000001'::uuid
               and status<>'pending') then
    raise exception 'A reporter changed their own report status';
  end if;
  begin
    update public.account_notifications set read_at=now()
    where id=v_note;
    raise exception 'SENTINEL: a user changed another user''s notification';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
  begin
    insert into public.account_notifications(recipient_id,kind,title,body,target_path)
    values (v_outside,'new_message','Forged notice','A forged client-side notification.','/messages');
    raise exception 'SENTINEL: a client inserted a notification directly';
  exception when insufficient_privilege then null;
  end;
end
$outsider_rls$;
reset role;

-- 3. Report owner sees their own report; admin sees all; non-admin cannot
--    moderate and cannot forge an audit event.
set role authenticated;
do $report_visibility$
declare
  v_reader uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
  v_post uuid := '00000000-0000-0000-00c1-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_reader::text,true);
  if not exists (select 1 from public.community_reports
                 where id='00000000-0000-0000-00c3-000000000001'::uuid) then
    raise exception 'Reporter cannot read their own report';
  end if;
  begin
    perform public.moderate_community_post(v_post,'hidden');
    raise exception 'SENTINEL: non-admin moderated a community post';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
end
$report_visibility$;
reset role;

set role authenticated;
do $admin_visibility$
declare
  v_admin uuid := '00000000-0000-0000-00c0-000000000004'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  if (select count(*) from public.community_reports)<>1 then
    raise exception 'Admin cannot inspect the abuse report';
  end if;
end
$admin_visibility$;
reset role;

-- 4. RSVPs are private and writable only through the owner-checked RPC.
set role authenticated;
do $rsvp_contract$
declare
  v_member uuid := '00000000-0000-0000-00c0-000000000003'::uuid;
  v_reader uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
  v_event uuid := '00000000-0000-0000-00c6-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_member::text,true);
  begin
    insert into public.community_event_rsvps(event_id,user_id,status)
    values (v_event,v_member,'going');
    raise exception 'SENTINEL: client wrote an event RSVP directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_event_response(v_event,'attending');
    raise exception 'SENTINEL: unknown RSVP status accepted';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
  perform public.set_event_response(v_event,'going');
  if not exists (select 1 from public.community_event_rsvps
                 where event_id=v_event and user_id=v_member) then
    raise exception 'Valid event response was not recorded';
  end if;

  perform set_config('request.jwt.claim.sub',v_reader::text,true);
  if exists (select 1 from public.community_event_rsvps where event_id=v_event) then
    raise exception 'Another user read a private event response';
  end if;
end
$rsvp_contract$;
reset role;

-- 5. Admin hides the post. Hidden content disappears from non-authors and
--    from the aggregate reaction read, but the author keeps a private view.
set role authenticated;
do $moderate$
declare
  v_admin uuid := '00000000-0000-0000-00c0-000000000004'::uuid;
  v_post uuid := '00000000-0000-0000-00c1-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.moderate_community_post(v_post,'hidden');
  if not exists (select 1 from public.network_audit_events
                 where actor_id=v_admin and action='community_post_moderated'
                   and detail->>'post_id'=v_post::text) then
    raise exception 'Moderation was not written to the independent audit trail';
  end if;
end
$moderate$;
reset role;

-- A moderator cannot read hidden posts through RLS either; verify the stored
-- state from the server-side context that owns the table.
do $hidden_state$
begin
  if not exists (select 1 from public.community_posts
                 where id='00000000-0000-0000-00c1-000000000001'::uuid
                   and visibility='hidden') then
    raise exception 'Admin moderation did not hide the post';
  end if;
end
$hidden_state$;

set role authenticated;
do $hidden_rls$
declare
  v_author uuid := '00000000-0000-0000-00c0-000000000001'::uuid;
  v_reader uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
  v_post uuid := '00000000-0000-0000-00c1-000000000001'::uuid;
  v_reactions integer;
begin
  perform set_config('request.jwt.claim.sub',v_reader::text,true);
  if exists (select 1 from public.community_posts where id=v_post) then
    raise exception 'A hidden post is still visible to a non-author';
  end if;
  if exists (select 1 from public.community_comments
             where post_id='00000000-0000-0000-00c2-000000000001'::uuid) then
    raise exception 'Comments on a hidden post are still visible';
  end if;
  select count(*) into v_reactions
  from public.community_reactions_for_posts(array[v_post]::uuid[]);
  if v_reactions<>0 then
    raise exception 'Hidden post still appears in the aggregate reaction read';
  end if;

  perform set_config('request.jwt.claim.sub',v_author::text,true);
  if not exists (select 1 from public.community_posts where id=v_post) then
    raise exception 'Author lost the private view of their own hidden post';
  end if;
end
$hidden_rls$;
reset role;

-- 6. Group content is member-only.
set role authenticated;
do $group_rls$
declare
  v_reader uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
  v_group uuid := '00000000-0000-0000-00c4-000000000001'::uuid;
  v_host uuid := '00000000-0000-0000-00c0-000000000003'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_reader::text,true);
  if exists (select 1 from public.community_group_posts where group_id=v_group) then
    raise exception 'A non-member read a private group post';
  end if;
  begin
    insert into public.community_group_posts(group_id,author_id,body,visibility)
    values (v_group,v_reader,'A non-member tried to publish in the group.','published');
    raise exception 'SENTINEL: non-member published a group post';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',v_host::text,true);
  if not exists (select 1 from public.community_group_posts where group_id=v_group) then
    raise exception 'Group member cannot read their own group post';
  end if;
  perform public.set_event_response('00000000-0000-0000-00c6-000000000001'::uuid,'none');
end
$group_rls$;
reset role;

-- Unavailable events reject responses even through the RPC.
do $hide_event$
begin
  update public.community_events set visibility='hidden'
  where id='00000000-0000-0000-00c6-000000000001'::uuid;
end
$hide_event$;
set role authenticated;
do $hidden_event$
declare v_member uuid := '00000000-0000-0000-00c0-000000000003'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_member::text,true);
  begin
    perform public.set_event_response('00000000-0000-0000-00c6-000000000001'::uuid,'going');
    raise exception 'SENTINEL: a hidden event accepted an RSVP';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
end
$hidden_event$;
reset role;

-- 7. Notification target hints accept only fixed routes or one opaque UUID
--    and reject external URLs or arbitrary query strings at the database.
do $target_paths$
declare
  v_bad text;
  v_recipient uuid := '00000000-0000-0000-00c0-000000000002'::uuid;
begin
  foreach v_bad in array array[
    'https://evil.example/steal','//evil.example','/admin',
    '/jobs?anything=1','/messages?quote=not-a-uuid','/bookings?booking=abc',
    '/messages?quote=00000000-0000-0000-00c8-000000000001&x=1']::text[]
  loop
    begin
      insert into public.account_notifications(recipient_id,kind,title,body,target_path)
      values (v_recipient,'new_message','Unsafe target','An unsafe navigation hint.',v_bad);
      raise exception 'SENTINEL: unsafe notification target accepted: %',v_bad;
    exception when check_violation then null;
    end;
  end loop;
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values (v_recipient,'new_quote','Safe target','A permitted deep link.','/jobs');
end
$target_paths$;

rollback;
select 'Community moderation and notification RLS contract passed' as result;
