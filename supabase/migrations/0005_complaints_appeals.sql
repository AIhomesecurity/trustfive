-- Fair complaint and appeal workflow: allegations do NOT auto-remove professionals.
begin;
create table public.booking_complaints (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.job_bookings(id),
 reporter_id uuid not null references public.profiles(id),
 respondent_id uuid not null references public.profiles(id),
 category text not null check(category in ('quality','safety','conduct','billing','other')),
 statement text not null check(char_length(btrim(statement)) between 30 and 4000),
 respondent_statement text check(char_length(btrim(respondent_statement)) between 20 and 4000),
 responded_at timestamptz,
 status text not null default 'submitted'
   check(status in ('submitted','investigating','substantiated','unsubstantiated')),
 resolution_reason text,
 resolved_by uuid references auth.users(id),
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 check(reporter_id<>respondent_id)
);
create index booking_complaints_reporter_idx on public.booking_complaints(reporter_id,created_at desc);
create index booking_complaints_respondent_idx on public.booking_complaints(respondent_id,created_at desc);
alter table public.booking_complaints enable row level security;
create policy "parties and admins read complaints" on public.booking_complaints for select
to authenticated using (
 reporter_id=(select auth.uid()) or respondent_id=(select auth.uid())
 or (select public.is_trustfive_admin())
);
create policy "booking participants can report another participant" on public.booking_complaints for insert
to authenticated with check (
 reporter_id=(select auth.uid()) and status='submitted' and respondent_statement is null
 and resolution_reason is null and resolved_by is null
 and exists(
   select 1 from public.job_bookings b where b.id=booking_id
     and ((b.customer_id=reporter_id and b.professional_id=respondent_id)
       or (b.professional_id=reporter_id and b.customer_id=respondent_id))
 )
);

create table public.complaint_appeals (
 id uuid primary key default gen_random_uuid(),
 complaint_id uuid not null references public.booking_complaints(id) on delete cascade,
 appellant_id uuid not null references public.profiles(id),
 reason text not null check(char_length(btrim(reason)) between 30 and 4000),
 status text not null default 'pending'
   check(status in ('pending','upheld','denied')),
 reviewed_by uuid references auth.users(id),
 review_note text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(complaint_id,appellant_id)
);
alter table public.complaint_appeals enable row level security;
create policy "appeal parties and admins read" on public.complaint_appeals for select
to authenticated using (
 appellant_id=(select auth.uid()) or
 (select public.is_trustfive_admin())
);
create policy "parties appeal an investigated complaint" on public.complaint_appeals for insert
to authenticated with check(
 appellant_id=(select auth.uid()) and status='pending' and review_note is null
 and exists(
  select 1 from public.booking_complaints c where c.id=complaint_id
    and c.status in ('substantiated','unsubstantiated')
    and (c.reporter_id=appellant_id or c.respondent_id=appellant_id)
 )
);

create or replace function public.respond_to_booking_complaint(p_complaint uuid,p_response text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if char_length(btrim(coalesce(p_response,''))) not between 20 and 4000 then
  raise exception 'Response must be between 20 and 4000 characters';
 end if;
 update public.booking_complaints
   set respondent_statement=btrim(p_response),responded_at=now(),status='investigating'
 where id=p_complaint and respondent_id=auth.uid() and respondent_statement is null
   and status in ('submitted','investigating');
 if not found then raise exception 'Complaint not found, already answered, or not yours';
 end if;
 insert into public.network_audit_events(actor_id,action,detail)
 values(auth.uid(),'complaint_responded',jsonb_build_object('complaint_id',p_complaint));
end $$;
revoke all on function public.respond_to_booking_complaint(uuid,text) from public,anon;
grant execute on function public.respond_to_booking_complaint(uuid,text) to authenticated;

create or replace function public.resolve_booking_complaint(
 p_complaint uuid,p_outcome text,p_reason text
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_trustfive_admin() then raise exception 'Not authorised' using errcode='42501'; end if;
 if p_outcome not in ('substantiated','unsubstantiated') then
  raise exception 'Invalid resolution outcome';
 end if;
 if char_length(btrim(coalesce(p_reason,''))) < 30 then
  raise exception 'Evidence-based resolution reason required (at least 30 characters)';
 end if;
 update public.booking_complaints set
  status=p_outcome,resolution_reason=btrim(p_reason),resolved_by=auth.uid(),resolved_at=now()
 where id=p_complaint and status in ('submitted','investigating');
 if not found then raise exception 'Complaint is already resolved or missing'; end if;
 insert into public.network_audit_events(actor_id,action,detail)
 values(auth.uid(),'complaint_resolved',jsonb_build_object('complaint_id',p_complaint,'outcome',p_outcome));
 -- No automatic suspension or slot removal: independent, documented decision required.
end $$;
revoke all on function public.resolve_booking_complaint(uuid,text,text) from public,anon;
grant execute on function public.resolve_booking_complaint(uuid,text,text) to authenticated;

create or replace function public.resolve_complaint_appeal(
 p_appeal uuid,p_upheld boolean,p_reason text
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_trustfive_admin() then raise exception 'Not authorised' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_reason,''))) < 30 then
  raise exception 'Explain the appeal decision (minimum 30 characters)';
 end if;
 update public.complaint_appeals
  set status=case when p_upheld then 'upheld' else 'denied' end,
   reviewed_by=auth.uid(),review_note=btrim(p_reason),reviewed_at=now()
 where id=p_appeal and status='pending';
 if not found then raise exception 'Appeal not found or previously decided'; end if;
 insert into public.network_audit_events(actor_id,action,detail)
 values(auth.uid(),'complaint_appeal_decided',jsonb_build_object('appeal_id',p_appeal,'upheld',p_upheld));
 -- Reconsidering the underlying case still requires a separate human decision.
end $$;
revoke all on function public.resolve_complaint_appeal(uuid,boolean,text) from public,anon;
grant execute on function public.resolve_complaint_appeal(uuid,boolean,text) to authenticated;
commit;