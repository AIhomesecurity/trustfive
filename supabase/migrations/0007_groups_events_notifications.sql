-- TrustFive communities, events and private in-app notifications.
-- No location verification or realtime delivery is claimed by this migration.
begin;

create table public.community_groups (
 id uuid primary key default gen_random_uuid(),
 area_id uuid not null references public.service_areas(id),
 creator_id uuid not null references public.profiles(id),
 name text not null check(char_length(btrim(name)) between 4 and 100),
 description text not null check(char_length(btrim(description)) between 15 and 1200),
 visibility text not null default 'public' check(visibility in ('public','hidden')),
 created_at timestamptz not null default now()
);
create index community_groups_area_idx on public.community_groups(area_id,created_at desc);
alter table public.community_groups enable row level security;
create policy "members discover public groups" on public.community_groups for select to authenticated
 using(visibility='public' or creator_id=(select auth.uid()));
create policy "members create public local groups" on public.community_groups for insert to authenticated
 with check(creator_id=(select auth.uid()) and visibility='public');

create table public.community_group_memberships (
 group_id uuid not null references public.community_groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('owner','member')),
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
alter table public.community_group_memberships enable row level security;
create policy "members see own memberships" on public.community_group_memberships for select to authenticated
 using(user_id=(select auth.uid()));
create policy "join public groups as a member" on public.community_group_memberships for insert to authenticated
 with check(user_id=(select auth.uid()) and role='member' and exists(
  select 1 from public.community_groups g where g.id=group_id and g.visibility='public'
 ));
create policy "members can leave groups" on public.community_group_memberships for delete to authenticated
 using(user_id=(select auth.uid()) and role='member');

create or replace function public.add_group_creator()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.community_group_memberships(group_id,user_id,role)
 values(new.id,new.creator_id,'owner');
 return new;
end $$;
create trigger add_group_owner after insert on public.community_groups
for each row execute function public.add_group_creator();

create table public.community_group_posts (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.community_groups(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 8 and 3000),
 visibility text not null default 'published' check(visibility in ('published','hidden')),
 created_at timestamptz not null default now()
);
create index community_group_posts_idx on public.community_group_posts(group_id,created_at desc);
alter table public.community_group_posts enable row level security;
create policy "group members read approved posts" on public.community_group_posts for select to authenticated
 using((visibility='published' or author_id=(select auth.uid())) and exists(
  select 1 from public.community_group_memberships m
  where m.group_id=group_id and m.user_id=(select auth.uid())
 ));
create policy "group members publish their posts" on public.community_group_posts for insert to authenticated
 with check(author_id=(select auth.uid()) and visibility='published' and exists(
  select 1 from public.community_group_memberships m
  where m.group_id=group_id and m.user_id=(select auth.uid())
 ));

create table public.community_events (
 id uuid primary key default gen_random_uuid(),
 area_id uuid not null references public.service_areas(id),
 group_id uuid references public.community_groups(id) on delete set null,
 host_id uuid not null references public.profiles(id),
 title text not null check(char_length(btrim(title)) between 5 and 120),
 description text not null check(char_length(btrim(description)) between 15 and 2000),
 venue_label text not null check(char_length(btrim(venue_label)) between 3 and 160),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 visibility text not null default 'published' check(visibility in ('published','cancelled','hidden')),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index community_events_area_time_idx on public.community_events(area_id,starts_at);
alter table public.community_events enable row level security;
create policy "members discover published events" on public.community_events for select to authenticated
 using(visibility='published' or host_id=(select auth.uid()));
create policy "members publish local events" on public.community_events for insert to authenticated
 with check(host_id=(select auth.uid()) and visibility='published'
  and starts_at>now() and ends_at>starts_at
  and (group_id is null or exists(
    select 1 from public.community_groups g
    join public.community_group_memberships m on m.group_id=g.id
    where g.id=group_id and g.area_id=area_id
      and g.visibility='public' and m.user_id=(select auth.uid())
  )));

create table public.community_event_rsvps (
 event_id uuid not null references public.community_events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null check(status in ('going','interested')),
 responded_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
alter table public.community_event_rsvps enable row level security;
create policy "members see own event responses" on public.community_event_rsvps for select to authenticated
 using(user_id=(select auth.uid()));
-- All changes are funnelled through an owner-checked RPC, not client writes.
revoke insert,update,delete on public.community_event_rsvps from anon,authenticated;
create or replace function public.set_event_response(p_event uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_status not in ('going','interested','none') then raise exception 'Unknown event response'; end if;
 if not exists(select 1 from public.community_events e
  where e.id=p_event and e.visibility='published' and e.ends_at>now()) then
  raise exception 'Event is unavailable';
 end if;
 if p_status='none' then
   delete from public.community_event_rsvps
   where event_id=p_event and user_id=auth.uid();
 else
   insert into public.community_event_rsvps(event_id,user_id,status)
   values(p_event,auth.uid(),p_status)
   on conflict(event_id,user_id) do update set
    status=excluded.status,responded_at=now();
 end if;
end $$;
revoke all on function public.set_event_response(uuid,text) from public,anon;
grant execute on function public.set_event_response(uuid,text) to authenticated;

create table public.account_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in (
  'new_quote','quote_accepted','new_message','work_ready','job_completed','vacancy_offer'
 )),
 title text not null check(char_length(title) between 3 and 160),
 body text not null check(char_length(body) between 3 and 500),
 target_path text not null check(target_path~'^/(jobs|bookings|messages|professional/apply)(/|$)'),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index account_notifications_unread_idx on public.account_notifications(recipient_id,created_at desc);
alter table public.account_notifications enable row level security;
create policy "read only your account notifications" on public.account_notifications
for select to authenticated using(recipient_id=(select auth.uid()));
revoke insert,update,delete on public.account_notifications from anon,authenticated;

create or replace function public.mark_notification_read(p_notification uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 update public.account_notifications set read_at=coalesce(read_at,now())
 where id=p_notification and recipient_id=auth.uid();
 return found;
end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.emit_quote_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_customer uuid;v_pro uuid;
begin
 if tg_op='INSERT' then
  select customer_id into v_customer from public.jobs where id=new.job_id;
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
   values(v_customer,'new_quote','New quote received',
   'An approved professional has sent a quote for your job.','/jobs');
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'quote_accepted','Your quote was accepted',
    'The customer accepted your quote. Review the confirmed booking.','/bookings');
 end if;
 return new;
end $$;
create trigger notify_quote after insert or update of status on public.job_quotes
for each row execute function public.emit_quote_notification();

create or replace function public.emit_message_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_customer uuid;v_professional uuid;v_recipient uuid;
begin
 select j.customer_id,q.professional_id into v_customer,v_professional
 from public.job_quotes q join public.jobs j on j.id=q.job_id where q.id=new.quote_id;
 v_recipient=case when new.author_id=v_customer then v_professional else v_customer end;
 if v_recipient is not null then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_recipient,'new_message','New private message',
   'A quote participant sent you a message.','/messages');
 end if;
 return new;
end $$;
create trigger notify_quote_message after insert on public.quote_messages
for each row execute function public.emit_message_notification();

create or replace function public.emit_booking_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='awaiting_customer' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.customer_id,'work_ready','Confirm completed work',
    'The professional marked your booking ready for completion confirmation.','/bookings');
 elsif new.status='completed' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'job_completed','Job confirmed complete',
    'The customer confirmed the job is complete.','/bookings');
 end if;
 return new;
end $$;
create trigger notify_booking_state after update of status on public.job_bookings
for each row execute function public.emit_booking_notification();

create or replace function public.emit_vacancy_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_user uuid;
begin
 select user_id into v_user from public.professional_applications
 where id=new.application_id;
 if v_user is not null then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_user,'vacancy_offer','TrustFive vacancy offer',
   'You have a time-limited offer for an approved professional place.','/professional/apply');
 end if;
 return new;
end $$;
create trigger notify_vacancy after insert on public.vacancy_offers
for each row execute function public.emit_vacancy_notification();

commit;