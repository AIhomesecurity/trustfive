-- Preserve the exact authorised quote or booking context in account
-- notifications. These are navigation hints, NEVER access grants: message and
-- booking pages still enforce account visibility via RLS and guarded queries.
begin;

-- Preserve fixed, safe destinations while allowing one opaque UUID parameter.
-- Old rows remain valid; no external URL or arbitrary query string is permitted.
alter table public.account_notifications
 drop constraint if exists account_notifications_target_path_check;
alter table public.account_notifications
 add constraint account_notifications_target_path_check check (
  target_path in ('/jobs','/bookings','/messages','/professional/apply')
  or target_path ~ '^/messages\\?quote=[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;v_professional uuid;v_recipient uuid;
begin
 select j.customer_id,q.professional_id into v_customer,v_professional
 from public.job_quotes q join public.jobs j on j.id=q.job_id
 where q.id=new.quote_id;
 v_recipient=case when new.author_id=v_customer then v_professional else v_customer end;
 if v_recipient is not null then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_recipient,'new_message','New private message',
   'A quote participant sent you a message.','/messages?quote='||new.quote_id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_quote_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;
begin
 if tg_op='INSERT' then
  select customer_id into v_customer from public.jobs where id=new.job_id;
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_customer,'new_quote','New quote received',
   'An approved professional has sent a quote for your job.',
   '/messages?quote='||new.id::text);
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'quote_accepted','Your quote was accepted',
   'The customer accepted your quote. Review the confirmed booking.',
   '/messages?quote='||new.id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_booking_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
begin
 if new.status='awaiting_customer' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.customer_id,'work_ready','Confirm completed work',
   'The professional marked your booking ready for completion confirmation.',
   '/bookings?booking='||new.id::text);
 elsif new.status='completed' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'job_completed','Job confirmed complete',
   'The customer confirmed the job is complete.','/bookings?booking='||new.id::text);
 end if;
 return new;
end;
$tf$;

-- Trigger functions do not require direct execution permission by clients.
revoke all on function public.emit_message_notification() from public,anon,authenticated;
revoke all on function public.emit_quote_notification() from public,anon,authenticated;
revoke all on function public.emit_booking_notification() from public,anon,authenticated;

commit;

  or target_path ~ '^/bookings\\?booking=[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;v_professional uuid;v_recipient uuid;
begin
 select j.customer_id,q.professional_id into v_customer,v_professional
 from public.job_quotes q join public.jobs j on j.id=q.job_id
 where q.id=new.quote_id;
 v_recipient=case when new.author_id=v_customer then v_professional else v_customer end;
 if v_recipient is not null then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_recipient,'new_message','New private message',
   'A quote participant sent you a message.','/messages?quote='||new.quote_id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_quote_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;
begin
 if tg_op='INSERT' then
  select customer_id into v_customer from public.jobs where id=new.job_id;
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_customer,'new_quote','New quote received',
   'An approved professional has sent a quote for your job.',
   '/messages?quote='||new.id::text);
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'quote_accepted','Your quote was accepted',
   'The customer accepted your quote. Review the confirmed booking.',
   '/messages?quote='||new.id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_booking_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
begin
 if new.status='awaiting_customer' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.customer_id,'work_ready','Confirm completed work',
   'The professional marked your booking ready for completion confirmation.',
   '/bookings?booking='||new.id::text);
 elsif new.status='completed' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'job_completed','Job confirmed complete',
   'The customer confirmed the job is complete.','/bookings?booking='||new.id::text);
 end if;
 return new;
end;
$tf$;

-- Trigger functions do not require direct execution permission by clients.
revoke all on function public.emit_message_notification() from public,anon,authenticated;
revoke all on function public.emit_quote_notification() from public,anon,authenticated;
revoke all on function public.emit_booking_notification() from public,anon,authenticated;

commit;

 );

create or replace function public.emit_message_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;v_professional uuid;v_recipient uuid;
begin
 select j.customer_id,q.professional_id into v_customer,v_professional
 from public.job_quotes q join public.jobs j on j.id=q.job_id
 where q.id=new.quote_id;
 v_recipient=case when new.author_id=v_customer then v_professional else v_customer end;
 if v_recipient is not null then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_recipient,'new_message','New private message',
   'A quote participant sent you a message.','/messages?quote='||new.quote_id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_quote_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_customer uuid;
begin
 if tg_op='INSERT' then
  select customer_id into v_customer from public.jobs where id=new.job_id;
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(v_customer,'new_quote','New quote received',
   'An approved professional has sent a quote for your job.',
   '/messages?quote='||new.id::text);
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'quote_accepted','Your quote was accepted',
   'The customer accepted your quote. Review the confirmed booking.',
   '/messages?quote='||new.id::text);
 end if;
 return new;
end;
$tf$;

create or replace function public.emit_booking_notification()
returns trigger language plpgsql security definer set search_path=''
as $tf$
begin
 if new.status='awaiting_customer' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.customer_id,'work_ready','Confirm completed work',
   'The professional marked your booking ready for completion confirmation.',
   '/bookings?booking='||new.id::text);
 elsif new.status='completed' and old.status is distinct from new.status then
  insert into public.account_notifications(recipient_id,kind,title,body,target_path)
  values(new.professional_id,'job_completed','Job confirmed complete',
   'The customer confirmed the job is complete.','/bookings?booking='||new.id::text);
 end if;
 return new;
end;
$tf$;

-- Trigger functions do not require direct execution permission by clients.
revoke all on function public.emit_message_notification() from public,anon,authenticated;
revoke all on function public.emit_quote_notification() from public,anon,authenticated;
revoke all on function public.emit_booking_notification() from public,anon,authenticated;

commit;
