-- Positive message-entitlement contract: the customer and the booked
-- professional can read their quote thread; an unrelated signed-in account and
-- an anonymous visitor cannot. This complements the existing negative checks
-- (which only prove that an outsider cannot inject a message) with exact read
-- counts, so a future RLS regression cannot silently hide the thread from its
-- legitimate participants or expose it through a broadened policy.
--
-- All fixtures use synthetic UUIDs and are rolled back; no live records are read.
begin;

-- Four synthetic identities: quote customer, booked professional, a signed-in
-- outsider and a second outsider used only for an additional negative read.
insert into auth.users(id, raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001', '{"full_name":"Synthetic Message Customer","requested_role":"customer"}'),
 ('a1000000-0000-4000-8000-000000000002', '{"full_name":"Synthetic Booked Professional","requested_role":"professional"}'),
 ('a1000000-0000-4000-8000-000000000003', '{"full_name":"Synthetic Unrelated Customer","requested_role":"customer"}'),
 ('a1000000-0000-4000-8000-000000000004', '{"full_name":"Synthetic Unrelated Professional","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.trades(id, slug, name)
values ('a2000000-0000-4000-8000-000000000001', 'synthetic-message-entitlement-trade', 'Synthetic Message Entitlement Trade')
on conflict (id) do nothing;

insert into public.service_areas(id, country_code, region, city, area_name)
values ('a3000000-0000-4000-8000-000000000001', 'GB', 'Synthetic Region', 'Synthetic City', 'Synthetic Message Entitlement Area')
on conflict (id) do nothing;

-- The quota triggers require an authenticated identity even when a privileged
-- rehearsal role seeds the fixtures, so set the synthetic actor before writes.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.jobs(id, customer_id, trade_id, area_id, title, description, status)
values (
 'a4000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001',
 'a2000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000001',
 'Synthetic camera installation',
 'Synthetic brief used only for the disposable message entitlement rehearsal.',
 'open'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
insert into public.job_quotes(
 id, job_id, professional_id, amount_pence, message, status
) values (
 'a5000000-0000-4000-8000-000000000001',
 'a4000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000002',
 24500,
 'Synthetic installation quote with full public liability cover.',
 'pending'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.job_bookings(
 id, quote_id, job_id, customer_id, professional_id, status
) values (
 'a6000000-0000-4000-8000-000000000001',
 'a5000000-0000-4000-8000-000000000001',
 'a4000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000002',
 'booked'
);

-- Two genuine participant messages, one from each side of the booking.
insert into public.quote_messages(quote_id, author_id, body) values
 ('a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
  'Synthetic customer: please install after 10am on Thursday.'),
 ('a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',
  'Synthetic professional: confirmed, camera kit and certificate included.');

-- Legitimate customer: exactly two visible messages.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
do $customer$
begin
 if (select count(*) from public.quote_messages) <> 2 then
  raise exception 'Booked customer read % messages, expected exactly 2',
   (select count(*) from public.quote_messages);
 end if;
 if not public.can_access_quote('a5000000-0000-4000-8000-000000000001') then
  raise exception 'Booked customer lost quote-thread access';
 end if;
end
$customer$;

-- Legitimate booked professional: exactly the same two visible messages.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
do $professional$
begin
 if (select count(*) from public.quote_messages) <> 2 then
  raise exception 'Booked professional read % messages, expected exactly 2',
   (select count(*) from public.quote_messages);
 end if;
 if not public.can_access_quote('a5000000-0000-4000-8000-000000000001') then
  raise exception 'Booked professional lost quote-thread access';
 end if;
end
$professional$;

-- Unrelated signed-in customer: zero messages, zero quote access.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
do $outsider_customer$
begin
 if (select count(*) from public.quote_messages) <> 0 then
  raise exception 'Unrelated customer read % private messages',
   (select count(*) from public.quote_messages);
 end if;
 if public.can_access_quote('a5000000-0000-4000-8000-000000000001') then
  raise exception 'Unrelated customer gained quote-thread access';
 end if;
end
$outsider_customer$;

-- Unrelated signed-in professional: zero messages, zero quote access.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
do $outsider_professional$
begin
 if (select count(*) from public.quote_messages) <> 0 then
  raise exception 'Unrelated professional read % private messages',
   (select count(*) from public.quote_messages);
 end if;
 if public.can_access_quote('a5000000-0000-4000-8000-000000000001') then
  raise exception 'Unrelated professional gained quote-thread access';
 end if;
end
$outsider_professional$;

-- Anonymous visitor: zero messages even though the table has an anon grant.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $anonymous$
begin
 if (select count(*) from public.quote_messages) <> 0 then
  raise exception 'Anonymous visitor read % private messages',
   (select count(*) from public.quote_messages);
 end if;
end
$anonymous$;

rollback;

select 'Message entitlement contract passed: customer=2, booked professional=2, unrelated customer=0, unrelated professional=0, anonymous=0' as result;
