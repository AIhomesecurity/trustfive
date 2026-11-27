-- Migration 0059: keep poll votes private while returning safe aggregate results.
-- Also validate Social poll options and member skills at the database boundary,
-- and limit connection/poll updates to their intended status transitions.

create or replace function public.validate_social_member_profile_skills()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_skill text;
begin
  if coalesce(array_length(new.skills, 1), 0) > 12 then
    raise exception using errcode = '23514', message = 'A social member may list at most 12 skills.';
  end if;

  foreach v_skill in array coalesce(new.skills, array[]::text[]) loop
    if char_length(trim(v_skill)) not between 2 and 60
       or not public.showcase_contact_free(v_skill) then
      raise exception using errcode = '23514', message = 'Social skills must be short and contact-free.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists social_member_profile_skills_guard on public.social_member_profiles;
create trigger social_member_profile_skills_guard
before insert or update of skills on public.social_member_profiles
for each row execute function public.validate_social_member_profile_skills();

create or replace function public.validate_social_poll_options()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_option text;
  v_option_count integer;
  v_unique_count integer;
begin
  if jsonb_typeof(new.options) <> 'array'
     or jsonb_array_length(new.options) not between 2 and 4 then
    raise exception using errcode = '23514', message = 'Polls need between 2 and 4 options.';
  end if;

  select count(*) into v_option_count
  from jsonb_array_elements(new.options) as options(value)
  where jsonb_typeof(options.value) = 'string';

  if v_option_count <> jsonb_array_length(new.options) then
    raise exception using errcode = '23514', message = 'Poll options must be text.';
  end if;

  select count(distinct lower(trim(value))) into v_unique_count
  from jsonb_array_elements_text(new.options) as options(value);

  if v_unique_count <> jsonb_array_length(new.options) then
    raise exception using errcode = '23514', message = 'Poll options must be unique.';
  end if;

  for v_option in
    select value from jsonb_array_elements_text(new.options) as options(value)
  loop
    if char_length(trim(v_option)) not between 2 and 80
       or not public.showcase_contact_free(v_option) then
      raise exception using errcode = '23514', message = 'Poll options must be short and contact-free.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists social_poll_options_guard on public.social_polls;
create trigger social_poll_options_guard
before insert or update of options on public.social_polls
for each row execute function public.validate_social_poll_options();

-- Raw vote rows are visible only to their owner. The aggregate RPC reveals
-- counts and the caller's own selection, never another voter's identity/choice.
drop policy if exists "authenticated read poll votes" on public.social_poll_votes;
drop policy if exists "members read own poll vote" on public.social_poll_votes;
create policy "members read own poll vote"
  on public.social_poll_votes for select to authenticated
  using (voter_id = auth.uid());

create or replace function public.social_poll_summary(p_poll_ids uuid[])
returns table (
  poll_id uuid,
  vote_counts jsonb,
  my_option_index integer,
  total_votes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce((
      select jsonb_object_agg(t.option_index::text, t.vote_count)
      from (
        select v.option_index, count(*)::integer as vote_count
        from public.social_poll_votes v
        where v.poll_id = p.id
        group by v.option_index
      ) t
    ), '{}'::jsonb),
    (
      select mine.option_index
      from public.social_poll_votes mine
      where mine.poll_id = p.id and mine.voter_id = auth.uid()
    ),
    (
      select count(*)
      from public.social_poll_votes all_votes
      where all_votes.poll_id = p.id
    )
  from public.social_polls p
  where auth.uid() is not null
    and p.id = any(coalesce(p_poll_ids, array[]::uuid[]));
$$;

revoke all on function public.social_poll_summary(uuid[]) from public;
revoke all on function public.social_poll_summary(uuid[]) from anon;
grant execute on function public.social_poll_summary(uuid[]) to authenticated;

-- A connection recipient may only change the request status, not rewrite the
-- requester, recipient or original note.
revoke update on public.social_connections from authenticated;
grant update (status) on public.social_connections to authenticated;
drop policy if exists "addressees respond to connection requests" on public.social_connections;
create policy "addressees respond to connection requests"
  on public.social_connections for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted', 'declined'));

-- Poll authors may only close their open poll. Column grants prevent changing
-- poll contents or ownership through the status update path.
revoke update on public.social_polls from authenticated;
grant update (status) on public.social_polls to authenticated;
drop policy if exists "authors close own polls" on public.social_polls;
create policy "authors close own polls"
  on public.social_polls for update to authenticated
  using (author_id = auth.uid() and status = 'open')
  with check (author_id = auth.uid() and status = 'closed');
