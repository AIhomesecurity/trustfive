-- Rollback-only contract verifying migration 0055:
-- 1) moderate_community_report hides or dismisses only for authorised admins and logs audit events
-- 2) community_post_media enforces author-only EXIF-stripped raster uploads, anonymous denial, and admin moderation
-- 3) account_notifications accepts Social event/moderation kinds and rejects arbitrary paths
begin;

insert into auth.users(id, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111110055', '{"full_name":"Synthetic Author 55","requested_role":"customer"}'),
 ('22222222-2222-4222-8222-222222220055', '{"full_name":"Synthetic Member 55","requested_role":"customer"}'),
 ('33333333-3333-4333-8333-333333330055', '{"full_name":"Synthetic Admin 55","requested_role":"customer"}');

insert into public.platform_admins(user_id) values
 ('33333333-3333-4333-8333-333333330055');

insert into public.service_areas(id, country_code, city, area_name) values
 ('44444444-4444-4444-8444-444444440055', 'GB', 'Manchester', 'Didsbury Test 55')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111110055', true);

insert into public.community_posts(id, author_id, area_id, body, visibility) values
 ('55555555-5555-4555-8555-555555550001', '11111111-1111-4111-8111-111111110055', '44444444-4444-4444-8444-444444440055', 'Synthetic post one to be hidden by report RPC', 'published'),
 ('55555555-5555-4555-8555-555555550002', '11111111-1111-4111-8111-111111110055', '44444444-4444-4444-8444-444444440055', 'Synthetic post two whose report will be dismissed', 'published');

do $$
declare v_media uuid;
begin
 insert into public.community_post_media(post_id, author_id, storage_path, mime_type, byte_size, exif_stripped)
 values (
  '55555555-5555-4555-8555-555555550002',
  '11111111-1111-4111-8111-111111110055',
  'community-media/11111111-1111-4111-8111-111111110055/77777777-7777-4777-8777-777777770001.webp',
  'image/webp', 120000, true
 ) returning id into v_media;
 perform set_config('trustfive.media55', v_media::text, true);
end $$;

-- Ordinary member reports both posts; cannot attach media to author's post and cannot call moderation RPCs.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222220055', true);

insert into public.community_reports(id, post_id, reporter_id, category, explanation, status) values
 ('66666666-6666-4666-8666-666666660001', '55555555-5555-4555-8555-555555550001', '22222222-2222-4222-8222-222222220055', 'spam', 'Synthetic spam', 'pending'),
 ('66666666-6666-4666-8666-666666660002', '55555555-5555-4555-8555-555555550002', '22222222-2222-4222-8222-222222220055', 'other', 'Synthetic false alarm', 'pending');

do $$
begin
 begin
  insert into public.community_post_media(post_id, author_id, storage_path, mime_type, byte_size, exif_stripped)
  values (
   '55555555-5555-4555-8555-555555550002',
   '22222222-2222-4222-8222-222222220055',
   'community-media/22222222-2222-4222-8222-222222220055/88888888-8888-4888-8888-888888880002.png',
   'image/png', 8000, true
  );
  raise exception 'Non-author should not attach media to someone elses post';
 exception when insufficient_privilege then null;
 end;

 begin
  perform public.moderate_community_report('66666666-6666-4666-8666-666666660001', 'hide');
  raise exception 'Ordinary member should not moderate community reports';
 exception when insufficient_privilege then null;
 end;

 begin
  perform public.moderate_community_media(current_setting('trustfive.media55')::uuid, 'hidden');
  raise exception 'Ordinary member should not moderate community media';
 exception when insufficient_privilege then null;
 end;
end $$;

-- Anonymous cannot read community_post_media.
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.community_post_media;
  raise exception 'Anonymous role must not read community_post_media';
 exception when insufficient_privilege then null;
 end;
end $$;

-- Authorised admin hides report 1, dismisses report 2, and hides media attachment.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333330055', true);

select public.moderate_community_report('66666666-6666-4666-8666-666666660001', 'hide');
select public.moderate_community_report('66666666-6666-4666-8666-666666660002', 'dismiss');
select public.moderate_community_media(current_setting('trustfive.media55')::uuid, 'hidden');

-- Ordinary member sees hidden media disappear and post 1 hidden while post 2 stays published.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222220055', true);

do $$
declare v_media_count integer; v_post1_count integer; v_post2_count integer;
begin
 select count(*) into v_media_count from public.community_post_media where id = current_setting('trustfive.media55')::uuid;
 select count(*) into v_post1_count from public.community_posts where id = '55555555-5555-4555-8555-555555550001';
 select count(*) into v_post2_count from public.community_posts where id = '55555555-5555-4555-8555-555555550002';
 if v_media_count <> 0 then raise exception 'Hidden media remained visible to member'; end if;
 if v_post1_count <> 0 then raise exception 'Hidden reported post remained visible to member'; end if;
 if v_post2_count <> 1 then raise exception 'Dismissed reported post disappeared for member'; end if;
end $$;

-- Verify report statuses, audit events, and Social notification constraint.
reset role;
do $$
declare v_r1 text; v_r2 text; v_audit integer;
begin
 select status into v_r1 from public.community_reports where id = '66666666-6666-4666-8666-666666660001';
 select status into v_r2 from public.community_reports where id = '66666666-6666-4666-8666-666666660002';
 select count(*) into v_audit from public.network_audit_events where action in ('community_post_report_resolved', 'community_post_media_moderated');
 if v_r1 <> 'reviewed' or v_r2 <> 'dismissed' then
  raise exception 'Unexpected report statuses: %, %', v_r1, v_r2;
 end if;
 if v_audit < 3 then
  raise exception 'Expected at least 3 audit events, got %', v_audit;
 end if;

 insert into public.account_notifications(recipient_id, kind, title, body, target_path)
 values ('22222222-2222-4222-8222-222222220055', 'community_event', 'Upcoming event reminder', 'Community repair cafe starts soon.', '/community/social?tab=events');

 begin
  insert into public.account_notifications(recipient_id, kind, title, body, target_path)
  values ('22222222-2222-4222-8222-222222220055', 'community_event', 'Bad path test', 'Should fail target check.', 'https://evil.example/phish');
  raise exception 'External target_path must be rejected';
 exception when check_violation then null;
 end;
end $$;

rollback;
