-- TrustFive Trade Network structured collaboration security regression.
-- All identities and records are synthetic; transaction rolls back.
begin;

do $seed$
declare v_area uuid;v_trade uuid;
begin
 insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-0000-00f0-000000000001','{"full_name":"Synthetic Requester","requested_role":"professional"}'),
 ('00000000-0000-0000-00f0-000000000002','{"full_name":"Synthetic Responder","requested_role":"professional"}'),
 ('00000000-0000-0000-00f0-000000000003','{"full_name":"Synthetic Outsider","requested_role":"customer"}');
 insert into public.service_areas(country_code,city,area_name)
 values ('GB','Synthetic Collaboration Town','Synthetic Collaboration Area')
 returning id into v_area;
 insert into public.trades(slug,name)
 values ('synthetic-collaboration','Synthetic Collaboration Specialist')
 returning id into v_trade;
 perform set_config('trustfive.collab_area',v_area::text,true);
 perform set_config('trustfive.collab_trade',v_trade::text,true);
 if has_table_privilege('anon','public.social_trade_requests','SELECT')
  or has_table_privilege('anon','public.social_trade_interests','SELECT') then
  raise exception 'Anonymous role may access professional collaboration tables';
 end if;
 -- No exact addresses, customer jobs, phone numbers or quotes in storage.
 if exists(select 1 from information_schema.columns
  where table_schema='public'
   and table_name in ('social_trade_requests','social_trade_interests')
   and column_name in ('customer_id','customer_job_id','job_id','address','phone','email','quote_id','message','scope_summary')) then
  raise exception 'Protected customer/contact/message field added to trade collaboration';
 end if;
end
$seed$;

set role authenticated;
do $registrations$
declare v_area uuid:=current_setting('trustfive.collab_area')::uuid;
 v_trade uuid:=current_setting('trustfive.collab_trade')::uuid;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00f0-000000000001',true);
 insert into public.professional_applications(user_id,trade_id,area_id,status)
 values ('00000000-0000-0000-00f0-000000000001',v_trade,v_area,'pending');
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00f0-000000000002',true);
 insert into public.professional_applications(user_id,trade_id,area_id,status)
 values ('00000000-0000-0000-00f0-000000000002',v_trade,v_area,'pending');
end
$registrations$;

do $requester$
declare v_user uuid:='00000000-0000-0000-00f0-000000000001'::uuid;
 v_request uuid:='00000000-0000-0000-00f1-000000000001'::uuid;
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.social_trade_requests(id,creator_id,trade_id,area_id,assistance_type,earliest_week)
 values (v_request,v_user,current_setting('trustfive.collab_trade')::uuid,
  current_setting('trustfive.collab_area')::uuid,'specialist_support',current_date+7);
 if not exists(select 1 from public.social_trade_requests where id=v_request) then
  raise exception 'Creator cannot see own collaboration request';
 end if;
 -- A requester may not express interest in their own request.
 begin
  insert into public.social_trade_interests(request_id,responder_id) values(v_request,v_user);
  raise exception 'SENTINEL: requester expressed interest in own request';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$requester$;

do $responder$
declare v_user uuid:='00000000-0000-0000-00f0-000000000002'::uuid;
 v_request uuid:='00000000-0000-0000-00f1-000000000001'::uuid;
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if not exists(select 1 from public.social_trade_requests where id=v_request and status='open') then
  raise exception 'Registered professional cannot discover open request';
 end if;
 insert into public.social_trade_interests(request_id,responder_id) values(v_request,v_user);
 if not exists(select 1 from public.social_trade_interests where request_id=v_request) then
  raise exception 'Responder cannot read own expression of interest';
 end if;
 begin
  update public.social_trade_requests set status='closed' where id=v_request;
  if exists(select 1 from public.social_trade_requests where id=v_request and status='closed') then
   raise exception 'SENTINEL: responder closed a request they do not own';
  end if;
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$responder$;

do $outsider$
declare v_user uuid:='00000000-0000-0000-00f0-000000000003'::uuid;
 v_request uuid:='00000000-0000-0000-00f1-000000000001'::uuid;
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if exists(select 1 from public.social_trade_requests where id=v_request)
  or exists(select 1 from public.social_trade_interests where request_id=v_request) then
  raise exception 'Non-professional customer saw trade collaboration data';
 end if;
 begin
  insert into public.social_trade_requests(creator_id,trade_id,area_id,assistance_type)
  values(v_user,current_setting('trustfive.collab_trade')::uuid,
   current_setting('trustfive.collab_area')::uuid,'repair');
  raise exception 'SENTINEL: non-professional customer created trade request';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$outsider$;

do $creator_checks$
declare v_user uuid:='00000000-0000-0000-00f0-000000000001'::uuid;
 v_request uuid:='00000000-0000-0000-00f1-000000000001'::uuid;
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if not exists(select 1 from public.social_trade_interests
  where request_id=v_request and responder_id='00000000-0000-0000-00f0-000000000002') then
  raise exception 'Request creator cannot see legitimate interest';
 end if;
 update public.social_trade_requests set status='closed' where id=v_request;
 if not exists(select 1 from public.social_trade_requests where id=v_request and status='closed') then
  raise exception 'Request creator could not close their request';
 end if;
end
$creator_checks$;

do $closed_request$
declare v_user uuid:='00000000-0000-0000-00f0-000000000002'::uuid;
 v_request uuid:='00000000-0000-0000-00f1-000000000001'::uuid;
begin
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 if exists(select 1 from public.social_trade_requests where id=v_request) then
  raise exception 'Closed request remains discoverable to other professionals';
 end if;
 delete from public.social_trade_interests
 where request_id=v_request and responder_id=v_user;
 if exists(select 1 from public.social_trade_interests where request_id=v_request) then
  raise exception 'Responder failed to withdraw own expression';
 end if;
 begin
  insert into public.social_trade_interests(request_id,responder_id) values(v_request,v_user);
  raise exception 'SENTINEL: interest inserted after request closed';
 exception when others then
  if sqlerrm like 'SENTINEL:%' then raise; end if;
 end;
end
$closed_request$;
reset role;
rollback;
