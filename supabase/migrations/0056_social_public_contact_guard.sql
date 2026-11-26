-- Prevent contact-detail sharing in public and member-visible Social text.
-- Private booking messages remain available; customer/professional contact flows
-- are governed separately by booking state and the marketplace messaging policy.
begin;

create or replace function public.enforce_public_social_contact_free()
returns trigger language plpgsql set search_path = '' as $$
declare
 v_text text;
begin
 if tg_table_name = 'community_groups' then
  v_text := concat_ws(' ', to_jsonb(new)->>'name', to_jsonb(new)->>'description');
 elsif tg_table_name = 'community_events' then
  v_text := concat_ws(' ', to_jsonb(new)->>'title', to_jsonb(new)->>'description', to_jsonb(new)->>'venue_label');
 else
  v_text := coalesce(to_jsonb(new)->>'body', '');
 end if;

 if not public.showcase_contact_free(v_text) then
  raise exception 'Remove phone numbers, email addresses, messaging handles, web links and full postcodes from public community content.'
   using errcode = '23514';
 end if;
 return new;
end
$$;

revoke all on function public.enforce_public_social_contact_free() from public, anon, authenticated;

create trigger community_posts_contact_free
 before insert or update of body on public.community_posts
 for each row execute function public.enforce_public_social_contact_free();
create trigger community_comments_contact_free
 before insert or update of body on public.community_comments
 for each row execute function public.enforce_public_social_contact_free();
create trigger community_group_posts_contact_free
 before insert or update of body on public.community_group_posts
 for each row execute function public.enforce_public_social_contact_free();
create trigger community_groups_contact_free
 before insert or update of name, description on public.community_groups
 for each row execute function public.enforce_public_social_contact_free();
create trigger community_events_contact_free
 before insert or update of title, description, venue_label on public.community_events
 for each row execute function public.enforce_public_social_contact_free();

commit;
