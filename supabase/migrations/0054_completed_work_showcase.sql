-- Public portfolios use moderated text and an explicit public projection.
begin;

create function public.showcase_contact_free(p_text text)
returns boolean language sql immutable set search_path = '' as $$
 select cleaned !~ '(https?\s*:|www[.]|@|[[:alnum:]-]+[.](co[.]uk|org[.]uk|com|net|org|uk|me)(\M)|whats[[:space:]-]*app|telegram)'
   and cleaned !~ '([0-9][[:space:].()+/-]*){7,}'
   and cleaned !~ '(\m(zero|oh|nought|one|two|three|four|five|six|seven|eight|nine|[0-9])\M[^[:alnum:]]+){6}(\m(zero|oh|nought|one|two|three|four|five|six|seven|eight|nine|[0-9])\M)'
   and cleaned !~ '\m[a-z]{1,2}[0-9][a-z0-9]?[[:space:]]*[0-9][a-z]{2}\M'
 from (select lower(regexp_replace(normalize(coalesce(p_text, ''), NFKC),
             U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]', '', 'g')) as cleaned) normalized
$$;

drop policy "public sees vetted business pages" on public.professional_business_pages;

create function public.public_showcase_business(p_application uuid, p_include_reviews boolean default false)
returns table(display_name text, description text, trade_slug text, area_id uuid, verified_reviews jsonb)
language sql stable security definer set search_path = '' as $$
 select case when public.showcase_contact_free(bp.display_name) then bp.display_name else 'TrustFive professional' end,
   case when public.showcase_contact_free(bp.description) then bp.description else null end,
   t.slug, a.area_id, case when p_include_reviews then coalesce((
     select jsonb_agg(jsonb_build_object('stars', review.stars, 'body', review.safe_body, 'date', review.created_at::date)
                      order by review.created_at desc, review.id)
     from (
       select r.id, r.stars, r.created_at,
         case when public.showcase_contact_free(r.body) then r.body else null end as safe_body
       from public.booking_reviews r
       where r.professional_id = bp.owner_id and r.moderation_status = 'published'
       order by r.created_at desc, r.id limit 10
     ) review
   ), '[]'::jsonb) else '[]'::jsonb end
 from public.professional_business_pages bp
 join public.professional_applications a on a.id = bp.application_id
 join public.trades t on t.id = a.trade_id
 where bp.application_id = p_application and bp.status = 'published'
   and public.is_active_approved_application(bp.application_id);
$$;
revoke all on function public.public_showcase_business(uuid, boolean) from public;
grant execute on function public.public_showcase_business(uuid, boolean) to anon, authenticated;

create function public.guard_showcase_business_contact()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.website_url is not null or new.public_phone is not null
    or not public.showcase_contact_free(new.display_name)
    or not public.showcase_contact_free(new.description) then
   raise exception 'Remove contact details, full postcodes and external links from your public business page.' using errcode = '23514';
 end if;
 return new;
end
$$;
create trigger guard_showcase_business_contact
before insert or update of display_name, description, website_url, public_phone
on public.professional_business_pages for each row
execute function public.guard_showcase_business_contact();

create table public.completed_work_showcases (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.professional_business_pages(application_id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 5 and 100),
 summary text not null check (char_length(btrim(summary)) between 30 and 2400),
 status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
 created_at timestamptz not null default now(),
 constraint showcase_text_contact_free check (public.showcase_contact_free(title) and public.showcase_contact_free(summary))
);
create index completed_work_showcases_business_idx on public.completed_work_showcases (application_id, created_at desc);
alter table public.completed_work_showcases enable row level security;
revoke all on public.completed_work_showcases from public, anon, authenticated;
grant select on public.completed_work_showcases to anon, authenticated;
grant insert (application_id, title, summary), update (status) on public.completed_work_showcases to authenticated;

create policy "read published showcases" on public.completed_work_showcases
for select to anon, authenticated using (
 status = 'published' and exists (select 1 from public.public_showcase_business(application_id))
);
create policy "owner and moderators read showcase submissions" on public.completed_work_showcases
for select to authenticated using (
 (select public.is_trustfive_admin()) or exists (
  select 1 from public.professional_business_pages bp
  where bp.application_id = completed_work_showcases.application_id and bp.owner_id = (select auth.uid())
 )
);
create policy "eligible business submits work for review" on public.completed_work_showcases
for insert to authenticated with check (
 status = 'pending' and exists (select 1 from public.public_showcase_business(application_id))
 and exists (select 1 from public.professional_business_pages bp
  where bp.application_id = completed_work_showcases.application_id and bp.owner_id = (select auth.uid()))
);
create policy "admin reviews showcases" on public.completed_work_showcases
for update to authenticated using ((select public.is_trustfive_admin()))
with check ((select public.is_trustfive_admin()) and status in ('published', 'hidden')
 and (status = 'hidden' or exists (select 1 from public.public_showcase_business(application_id))));
create trigger quota_showcase_submission before insert on public.completed_work_showcases
for each row execute function public.enforce_account_write_quota('showcase_submission','8','day');

create table public.completed_work_questions (
 id uuid primary key default gen_random_uuid(),
 showcase_id uuid not null references public.completed_work_showcases(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 5 and 800),
 from_business boolean not null default false,
 status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
 created_at timestamptz not null default now(),
 constraint showcase_question_contact_free check (public.showcase_contact_free(body))
);
create index completed_work_questions_showcase_idx on public.completed_work_questions (showcase_id, created_at);
alter table public.completed_work_questions enable row level security;
revoke all on public.completed_work_questions from public, anon, authenticated;
grant select (id, showcase_id, body, from_business, status, created_at) on public.completed_work_questions to anon, authenticated;
grant insert (showcase_id, body), update (status) on public.completed_work_questions to authenticated;

create function public.set_showcase_question_role() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.from_business := exists (
  select 1 from public.completed_work_showcases s
  join public.professional_business_pages bp on bp.application_id = s.application_id
  where s.id = new.showcase_id and bp.owner_id = (select auth.uid())
 );
 return new;
end
$$;
create trigger set_showcase_question_role before insert on public.completed_work_questions
for each row execute function public.set_showcase_question_role();
create trigger quota_showcase_question before insert on public.completed_work_questions
for each row execute function public.enforce_account_write_quota('showcase_question','12','hour');

create policy "read published showcase questions" on public.completed_work_questions
for select to anon, authenticated using (
 status = 'published' and exists (select 1 from public.completed_work_showcases s
  where s.id = showcase_id and s.status = 'published'
   and exists (select 1 from public.public_showcase_business(s.application_id)))
);
create policy "authors and moderators read showcase questions" on public.completed_work_questions
for select to authenticated using (author_id = (select auth.uid()) or (select public.is_trustfive_admin()));
create policy "signed-in users submit showcase questions" on public.completed_work_questions
for insert to authenticated with check (
 author_id = (select auth.uid()) and status = 'pending'
 and exists (select 1 from public.completed_work_showcases s
  where s.id = showcase_id and s.status = 'published'
   and exists (select 1 from public.public_showcase_business(s.application_id)))
);
create policy "admin reviews showcase questions" on public.completed_work_questions
for update to authenticated using ((select public.is_trustfive_admin()))
with check ((select public.is_trustfive_admin()) and status in ('published', 'hidden'));

commit;
