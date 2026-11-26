-- Migration 0057: Houzz-style private Homeowner Project Ideabooks & Budget Planner
-- Strictly owner-private via RLS (auth.uid() = owner_id). Never exposes home addresses,
-- never influences directory ranking, approval slots, or waiting-list order.

create table if not exists public.homeowner_ideabooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  room_type text not null default 'general_renovation'
    check (room_type in (
      'kitchen',
      'bathroom',
      'security_smart_home',
      'loft_roofing',
      'garden_exterior',
      'electrical_lighting',
      'heating_plumbing',
      'general_renovation'
    )),
  property_style text not null default 'semi_detached'
    check (property_style in (
      'victorian_terrace',
      'semi_detached',
      'modern_new_build',
      'rural_cottage',
      'flat_apartment',
      'commercial_unit'
    )),
  target_budget_pence integer not null default 0
    check (target_budget_pence >= 0 and target_budget_pence <= 100000000),
  notes text not null default '' check (char_length(notes) <= 1500),
  status text not null default 'planning'
    check (status in ('planning', 'quoting', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists homeowner_ideabooks_owner_created_idx
  on public.homeowner_ideabooks (owner_id, created_at desc);

create table if not exists public.homeowner_ideabook_items (
  id uuid primary key default gen_random_uuid(),
  ideabook_id uuid not null references public.homeowner_ideabooks(id) on delete cascade,
  item_kind text not null check (item_kind in ('showcase', 'cost_guide', 'note')),
  showcase_id uuid references public.completed_work_showcases(id) on delete set null,
  cost_guide_slug text check (
    cost_guide_slug is null or cost_guide_slug ~ '^[a-z0-9-]{2,64}$'
  ),
  title text not null check (char_length(trim(title)) between 3 and 140),
  estimated_pence integer not null default 0
    check (estimated_pence >= 0 and estimated_pence <= 100000000),
  notes text not null default '' check (char_length(notes) <= 600),
  created_at timestamptz not null default now()
);

create index if not exists homeowner_ideabook_items_book_created_idx
  on public.homeowner_ideabook_items (ideabook_id, created_at asc);

alter table public.homeowner_ideabooks enable row level security;
alter table public.homeowner_ideabook_items enable row level security;

drop policy if exists "owners read own ideabooks" on public.homeowner_ideabooks;
create policy "owners read own ideabooks"
  on public.homeowner_ideabooks
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "owners create own ideabooks" on public.homeowner_ideabooks;
create policy "owners create own ideabooks"
  on public.homeowner_ideabooks
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "owners update own ideabooks" on public.homeowner_ideabooks;
create policy "owners update own ideabooks"
  on public.homeowner_ideabooks
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owners delete own ideabooks" on public.homeowner_ideabooks;
create policy "owners delete own ideabooks"
  on public.homeowner_ideabooks
  for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "owners read own ideabook items" on public.homeowner_ideabook_items;
create policy "owners read own ideabook items"
  on public.homeowner_ideabook_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.homeowner_ideabooks b
      where b.id = ideabook_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "owners add items to own ideabooks" on public.homeowner_ideabook_items;
create policy "owners add items to own ideabooks"
  on public.homeowner_ideabook_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.homeowner_ideabooks b
      where b.id = ideabook_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "owners update own ideabook items" on public.homeowner_ideabook_items;
create policy "owners update own ideabook items"
  on public.homeowner_ideabook_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.homeowner_ideabooks b
      where b.id = ideabook_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.homeowner_ideabooks b
      where b.id = ideabook_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "owners delete own ideabook items" on public.homeowner_ideabook_items;
create policy "owners delete own ideabook items"
  on public.homeowner_ideabook_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.homeowner_ideabooks b
      where b.id = ideabook_id
        and b.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.homeowner_ideabooks to authenticated;
grant select, insert, update, delete on public.homeowner_ideabook_items to authenticated;
revoke all on public.homeowner_ideabooks from anon;
revoke all on public.homeowner_ideabook_items from anon;
