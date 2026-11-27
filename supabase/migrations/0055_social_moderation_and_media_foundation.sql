-- Social completion foundation: audited neighbourhood report resolution (hide/dismiss),
-- EXIF-stripped raster media metadata with strict RLS + write quota, and Social notification kinds.
begin;

-- 1. Audited resolution RPC for neighbourhood community_reports (mirrors 0053 group moderation).
create or replace function public.moderate_community_report(p_report uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_post uuid;
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode = '42501';
 end if;
 if p_action is null or p_action not in ('hide', 'dismiss') then
  raise exception 'Invalid report action' using errcode = '22023';
 end if;
 update public.community_reports
 set status = case p_action when 'hide' then 'reviewed' else 'dismissed' end
 where id = p_report and status = 'pending'
 returning post_id into v_post;
 if not found then
  raise exception 'Report no longer pending' using errcode = 'P0002';
 end if;
 if p_action = 'hide' then
  update public.community_posts set visibility = 'hidden' where id = v_post;
 end if;
 insert into public.network_audit_events(actor_id, action, detail)
 values(auth.uid(), 'community_post_report_resolved',
  jsonb_build_object('report_id', p_report, 'post_id', v_post, 'decision', p_action));
end $$;

revoke all on function public.moderate_community_report(uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_community_report(uuid, text) to authenticated;

-- 2. Private-by-default EXIF-stripped raster media attachments for published neighbourhood posts.
create table public.community_post_media (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 storage_path text not null check (
  storage_path ~ '^community-media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
 ),
 mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
 byte_size integer not null check (byte_size between 1 and 5242880),
 exif_stripped boolean not null default true check (exif_stripped = true),
 visibility text not null default 'published' check (visibility in ('published', 'hidden')),
 created_at timestamptz not null default now(),
 unique (storage_path)
);

create index community_post_media_post_idx on public.community_post_media(post_id, created_at);
alter table public.community_post_media enable row level security;
revoke all on public.community_post_media from public, anon, authenticated;
grant select on public.community_post_media to authenticated;
grant insert (post_id, author_id, storage_path, mime_type, byte_size, exif_stripped)
 on public.community_post_media to authenticated;

create policy "members read media on published posts" on public.community_post_media
 for select to authenticated using (
  (
   visibility = 'published'
   and exists (
    select 1 from public.community_posts p
    where p.id = community_post_media.post_id and p.visibility = 'published'
   )
  )
  or author_id = (select auth.uid())
  or (select public.is_trustfive_admin())
 );

create policy "authors attach stripped raster media to own published posts" on public.community_post_media
 for insert to authenticated with check (
  author_id = (select auth.uid())
  and visibility = 'published'
  and exif_stripped = true
  and exists (
   select 1 from public.community_posts p
   where p.id = community_post_media.post_id
    and p.author_id = (select auth.uid())
    and p.visibility = 'published'
  )
 );

create trigger quota_community_media before insert on public.community_post_media
 for each row execute function public.enforce_account_write_quota('community_media', '24', 'hour');

create or replace function public.moderate_community_media(p_media uuid, p_visibility text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode = '42501';
 end if;
 if p_visibility is null or p_visibility not in ('published', 'hidden') then
  raise exception 'Invalid media visibility' using errcode = '22023';
 end if;
 update public.community_post_media set visibility = p_visibility where id = p_media;
 if not found then
  raise exception 'Media attachment not found' using errcode = 'P0002';
 end if;
 insert into public.network_audit_events(actor_id, action, detail)
 values(auth.uid(), 'community_post_media_moderated',
  jsonb_build_object('media_id', p_media, 'visibility', p_visibility));
end $$;

revoke all on function public.moderate_community_media(uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_community_media(uuid, text) to authenticated;

-- 3. Safely allow Social event and moderation notification kinds & canonical /community paths.
alter table public.account_notifications
 drop constraint if exists account_notifications_kind_check;
alter table public.account_notifications
 add constraint account_notifications_kind_check check (kind in (
  'new_quote', 'quote_accepted', 'new_message', 'work_ready',
  'job_completed', 'vacancy_offer', 'appointment_proposed',
  'appointment_confirmed', 'appointment_cancelled',
  'community_event', 'community_moderation'
 ));

alter table public.account_notifications
 drop constraint if exists account_notifications_target_path_check;
alter table public.account_notifications
 add constraint account_notifications_target_path_check check (
  target_path in (
   '/jobs', '/bookings', '/messages', '/professional/apply',
   '/community/social', '/community/events', '/community/social?tab=events'
  )
  or target_path ~ '^/messages[?]quote=[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or target_path ~ '^/bookings[?]booking=[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 );

commit;
