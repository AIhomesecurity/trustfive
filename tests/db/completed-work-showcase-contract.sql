-- Pilot fixtures are discarded after exercising the public and private roles.
begin;
insert into auth.users(id) values
 ('ba000000-0000-0000-0000-000000000001'),
 ('ba000000-0000-0000-0000-000000000002'),
 ('ba000000-0000-0000-0000-000000000003');
insert into public.platform_admins(user_id) values ('ba000000-0000-0000-0000-000000000003');
insert into public.trades(id,slug,name) values ('ba000000-0000-0000-0000-000000000010','showcase-test','Showcase test');
insert into public.service_areas(id,country_code,city,area_name) values
 ('ba000000-0000-0000-0000-000000000011','GB','Fixture City','Fixture Area');
insert into public.professional_applications(id,user_id,trade_id,area_id,status) values (
 'ba000000-0000-0000-0000-000000000012','ba000000-0000-0000-0000-000000000001',
 'ba000000-0000-0000-0000-000000000010','ba000000-0000-0000-0000-000000000011','eligible');
insert into public.professional_assessments(application_id,reviewed_by,verification_state,satisfaction) values
 ('ba000000-0000-0000-0000-000000000012','ba000000-0000-0000-0000-000000000003','verified',25);
insert into public.vacancy_offers(application_id,trade_id,area_id,status) values
 ('ba000000-0000-0000-0000-000000000012','ba000000-0000-0000-0000-000000000010','ba000000-0000-0000-0000-000000000011','accepted');
insert into public.active_allocations(application_id,trade_id,area_id,slot) values
 ('ba000000-0000-0000-0000-000000000012','ba000000-0000-0000-0000-000000000010','ba000000-0000-0000-0000-000000000011',1);
insert into public.professional_business_pages(application_id,owner_id,display_name,description,status) values
 ('ba000000-0000-0000-0000-000000000012','ba000000-0000-0000-0000-000000000001','Test Aerials',
 'Fictional aerial installer for synthetic database tests.','published');

set local role authenticated;
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000001',true);
insert into public.completed_work_showcases(application_id,title,summary) values
 ('ba000000-0000-0000-0000-000000000012','Loft aerial upgrade','Replaced a damaged aerial and checked signal at the wall outlet.');

do $$
begin
 update public.completed_work_showcases set status='published' where title='Loft aerial upgrade';
 if found then raise exception 'Installer can publish their own showcase'; end if;
 if public.showcase_contact_free('Call zero seven one two three four five six seven eight nine')
    or public.showcase_contact_free('Call ０７１２３ ４５６７８９')
    or public.showcase_contact_free('Email contact@example.test')
    or public.showcase_contact_free('Postcode SW1A 1AA')
    or not public.showcase_contact_free('We installed two aerial sockets with a 10 m cable.') then
  raise exception 'Unexpected showcase contact-filter result';
 end if;
 begin
  insert into public.completed_work_showcases(application_id,title,summary) values
   ('ba000000-0000-0000-0000-000000000012','A second loft upgrade','We fixed the loft aerial. Book it on 07123 456789.');
  raise exception 'Contact details bypassed the database';
 exception when check_violation then null;
 end;
end $$;

set local role anon;
do $$
begin
 if exists (select 1 from public.completed_work_showcases where title='Loft aerial upgrade') then
  raise exception 'Pending showcase is visible publicly';
 end if;
 if exists (select 1 from public.professional_business_pages) then
  raise exception 'Business source fields are visible publicly';
 end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000003',true);
update public.completed_work_showcases set status='published' where title='Loft aerial upgrade';
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000002',true);
insert into public.completed_work_questions(showcase_id,body)
select id,'Would this also improve reception in a conservatory?' from public.completed_work_showcases where title='Loft aerial upgrade';
do $$
begin
 begin
  insert into public.completed_work_showcases(application_id,title,summary) values
   ('ba000000-0000-0000-0000-000000000012','Unrelated showcase','An unrelated customer must never post on this business.');
  raise exception 'An unrelated customer posted as a business';
 exception when insufficient_privilege then null;
 end;
end $$;

select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000001',true);
insert into public.completed_work_questions(showcase_id,body)
select id,'The results depend on the signal available at the property.' from public.completed_work_showcases where title='Loft aerial upgrade';
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000003',true);
update public.completed_work_questions set status='published' where showcase_id in
 (select id from public.completed_work_showcases where title='Loft aerial upgrade');
set local role anon;
do $$
begin
 if (select count(*) from public.completed_work_questions q join public.completed_work_showcases s
     on s.id=q.showcase_id where s.title='Loft aerial upgrade' and q.from_business) <> 1 then
  raise exception 'Business reply missing or incorrectly attributed';
 end if;
 if has_column_privilege('anon','public.completed_work_questions','author_id','SELECT')
    or has_column_privilege('authenticated','public.completed_work_questions','from_business','INSERT') then
  raise exception 'Public author identity disclosure or business attribution bypass';
 end if;
end $$;
rollback;
