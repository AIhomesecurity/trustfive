-- Rollback-only PostgreSQL security contract for Migration 0057:
-- Homeowner Project Ideabooks & Budget Planner strict owner-only RLS.

begin;

do $$
declare
  v_owner_a uuid := 'aaaaaaaa-0057-4000-8000-000000000001';
  v_owner_b uuid := 'aaaaaaaa-0057-4000-8000-000000000002';
  v_book_a  uuid;
  v_item_a  uuid;
  v_count   integer;
  v_blocked boolean;
begin
  insert into auth.users (id)
  values (v_owner_a), (v_owner_b)
  on conflict (id) do nothing;

  -- 1. Anonymous role cannot read or write homeowner_ideabooks
  execute 'set local role anon';
  v_blocked := false;
  begin
    perform count(*) from public.homeowner_ideabooks;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Expected anon SELECT on homeowner_ideabooks to be denied';
  end if;
  execute 'reset role';

  -- 2. Owner A creates a private Ideabook and adds a cost-guide item and custom note
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);

  insert into public.homeowner_ideabooks (owner_id, title, room_type, property_style, target_budget_pence, notes)
  values (v_owner_a, 'Driveway CCTV & Security Upgrade', 'security_smart_home', 'victorian_terrace', 120000, 'Need tidy black conduit along stone eaves.')
  returning id into v_book_a;

  insert into public.homeowner_ideabook_items (ideabook_id, item_kind, cost_guide_slug, title, estimated_pence, notes)
  values (v_book_a, 'cost_guide', 'cctv-installation', '4-camera 4K PoE CCTV installation', 89500, 'Front, side gate and rear garden')
  returning id into v_item_a;

  select count(*) into v_count from public.homeowner_ideabooks where id = v_book_a;
  if v_count <> 1 then
    raise exception 'Owner A should see own ideabook';
  end if;

  select count(*) into v_count from public.homeowner_ideabook_items where id = v_item_a;
  if v_count <> 1 then
    raise exception 'Owner A should see own ideabook item';
  end if;

  -- 3. Owner B cannot read, update, delete, or inject items into Owner A's Ideabook
  perform set_config('request.jwt.claim.sub', v_owner_b::text, true);

  select count(*) into v_count from public.homeowner_ideabooks where id = v_book_a;
  if v_count <> 0 then
    raise exception 'Owner B must NOT see Owner A ideabook';
  end if;

  select count(*) into v_count from public.homeowner_ideabook_items where ideabook_id = v_book_a;
  if v_count <> 0 then
    raise exception 'Owner B must NOT see Owner A ideabook items';
  end if;

  v_blocked := false;
  begin
    insert into public.homeowner_ideabook_items (ideabook_id, item_kind, title, estimated_pence)
    values (v_book_a, 'note', 'Injected by B', 5000);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Owner B must NOT insert items into Owner A ideabook';
  end if;

  update public.homeowner_ideabooks set title = 'Tampered' where id = v_book_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'Owner B must NOT update Owner A ideabook';
  end if;

  delete from public.homeowner_ideabook_items where id = v_item_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'Owner B must NOT delete Owner A ideabook items';
  end if;

  -- 4. Owner A can update and delete their own Ideabook (cascading items)
  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  update public.homeowner_ideabooks set status = 'quoting' where id = v_book_a;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Owner A should be able to update own ideabook';
  end if;

  delete from public.homeowner_ideabooks where id = v_book_a;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Owner A should be able to delete own ideabook';
  end if;

  execute 'reset role';
end
$$;

rollback;
