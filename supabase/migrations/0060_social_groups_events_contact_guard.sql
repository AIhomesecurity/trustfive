-- TrustFive Social: enforce contact-free constraints on public community groups
-- and community events to complete public Social anti-bypass coverage alongside
-- migration 0056 (community_posts, community_comments, community_group_posts).
-- Private booking conversations (quote_messages) remain intentionally unguarded
-- by this public Social policy.
begin;

alter table public.community_groups
  add constraint community_groups_contact_free
  check (
    public.showcase_contact_free(name)
    and public.showcase_contact_free(description)
  );

alter table public.community_events
  add constraint community_events_contact_free
  check (
    public.showcase_contact_free(title)
    and public.showcase_contact_free(description)
    and public.showcase_contact_free(venue_label)
  );

commit;
