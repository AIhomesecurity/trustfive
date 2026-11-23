#!/usr/bin/env bash
set -euo pipefail

# True multi-connection parallel PostgreSQL concurrency test for TrustFive's
# five-slot marketplace invariant.
#
# Race 1: 4 concurrent admin transactions calling offer_next_professional()
#         simultaneously for the 5th and final vacancy slot.
#         -> Exactly 1 succeeds (highest-scoring waiting-list Pro 5); 3 fail
#            cleanly with "No vacancy available".
#
# Race 2: 2 concurrent admin transactions calling activate_professional()
#         simultaneously for two accepted offers racing for slot #5.
#         -> Exactly 1 succeeds into slot #5; 1 fails cleanly with "No free slot";
#            total active_allocations stays strictly 5; loser stays waitlisted.
#
# All fixtures use isolated UUID namespace f5c00000-* and are unconditionally
# deleted on EXIT.

TRADE_ID="f5c00000-0000-0000-0001-000000000001"
AREA_ID="f5c00000-0000-0000-0002-000000000001"
ADMIN_ID="f5c00000-0000-0000-0000-000000000001"
APP5_ID="f5c00000-0000-0000-0003-000000000015"
APP6_ID="f5c00000-0000-0000-0003-000000000016"
PRO5_ID="f5c00000-0000-0000-0000-000000000015"

TMP_DIR="$(mktemp -d)"

cleanup_db() {
  psql -v ON_ERROR_STOP=1 -q <<SQL || true
delete from public.network_audit_events where application_id in (
  select id from public.professional_applications where trade_id = '${TRADE_ID}'
);
delete from public.active_allocations where trade_id = '${TRADE_ID}';
delete from public.vacancy_offers where trade_id = '${TRADE_ID}';
delete from public.professional_assessments where application_id in (
  select id from public.professional_applications where trade_id = '${TRADE_ID}'
);
delete from public.professional_applications where trade_id = '${TRADE_ID}';
delete from public.service_areas where id = '${AREA_ID}';
delete from public.trades where id = '${TRADE_ID}';
delete from public.platform_admins where user_id = '${ADMIN_ID}';
delete from auth.users where id::text like 'f5c00000-0000-0000-0000-0000000000%';
SQL
}

on_exit() {
  rm -rf "$TMP_DIR" || true
  cleanup_db
}
trap on_exit EXIT

# Clean any leftover synthetic rows before seeding
cleanup_db

echo "[1/4] Seeding 4 active professionals + 3 verified waiting-list applicants..."
psql -v ON_ERROR_STOP=1 -q <<SQL
insert into auth.users(id, raw_user_meta_data) values
  ('${ADMIN_ID}', '{"full_name":"Concurrency Admin","requested_role":"customer"}'),
  ('f5c00000-0000-0000-0000-000000000011', '{"full_name":"Conc Pro 1","requested_role":"professional"}'),
  ('f5c00000-0000-0000-0000-000000000012', '{"full_name":"Conc Pro 2","requested_role":"professional"}'),
  ('f5c00000-0000-0000-0000-000000000013', '{"full_name":"Conc Pro 3","requested_role":"professional"}'),
  ('f5c00000-0000-0000-0000-000000000014', '{"full_name":"Conc Pro 4","requested_role":"professional"}'),
  ('${PRO5_ID}', '{"full_name":"Conc Pro 5","requested_role":"professional"}'),
  ('f5c00000-0000-0000-0000-000000000016', '{"full_name":"Conc Pro 6","requested_role":"professional"}'),
  ('f5c00000-0000-0000-0000-000000000017', '{"full_name":"Conc Pro 7","requested_role":"professional"}');

insert into public.platform_admins(user_id) values ('${ADMIN_ID}');
insert into public.trades(id, slug, name) values ('${TRADE_ID}', 'five-slot-concurrency-trade', 'Five Slot Concurrency Trade');
insert into public.service_areas(id, country_code, region, city, area_name)
  values ('${AREA_ID}', 'GB', 'Conc Region', 'Conc City', 'Five Slot Concurrency Area');

insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status, submitted_at) values
  ('f5c00000-0000-0000-0003-000000000011', 'f5c00000-0000-0000-0000-000000000011', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 1', 'Verified pro 1', 10, 'pending', now() - interval '7 hours'),
  ('f5c00000-0000-0000-0003-000000000012', 'f5c00000-0000-0000-0000-000000000012', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 2', 'Verified pro 2', 9,  'pending', now() - interval '6 hours'),
  ('f5c00000-0000-0000-0003-000000000013', 'f5c00000-0000-0000-0000-000000000013', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 3', 'Verified pro 3', 8,  'pending', now() - interval '5 hours'),
  ('f5c00000-0000-0000-0003-000000000014', 'f5c00000-0000-0000-0000-000000000014', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 4', 'Verified pro 4', 7,  'pending', now() - interval '4 hours'),
  ('${APP5_ID}', '${PRO5_ID}', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 5', 'Verified pro 5', 6, 'pending', now() - interval '3 hours'),
  ('${APP6_ID}', 'f5c00000-0000-0000-0000-000000000016', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 6', 'Verified pro 6', 5, 'pending', now() - interval '2 hours'),
  ('f5c00000-0000-0000-0003-000000000017', 'f5c00000-0000-0000-0000-000000000017', '${TRADE_ID}', '${AREA_ID}', 'Conc Pro 7', 'Verified pro 7', 4, 'pending', now() - interval '1 hour');

do \$seed\$
declare
  v_i integer;
  v_app uuid;
  v_user uuid;
  v_offer uuid;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
  for v_i in 1..7 loop
    v_app := ('f5c00000-0000-0000-0003-00000000001' || v_i)::uuid;
    perform public.review_professional_application(
      v_app, true,
      (30 - v_i)::smallint, 24::smallint, 14::smallint, 14::smallint, 9::smallint, 5::smallint
    );
  end loop;

  -- Fill slots 1..4 leaving strictly 1 slot open (slot #5)
  for v_i in 1..4 loop
    perform set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
    v_offer := public.offer_next_professional('${TRADE_ID}', '${AREA_ID}');
    select a.id, a.user_id into v_app, v_user
    from public.vacancy_offers o
    join public.professional_applications a on a.id = o.application_id
    where o.id = v_offer;

    perform set_config('request.jwt.claim.sub', v_user::text, true);
    perform public.respond_to_vacancy_offer(v_offer, true);

    perform set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
    perform public.activate_professional(v_app);
  end loop;
end
\$seed\$;
SQL

echo "[2/4] Race 1: 4 concurrent admin sessions racing offer_next_professional() for final slot #5..."
# Hold advisory barrier lock 9500501 briefly so all 4 workers collide simultaneously
psql -v ON_ERROR_STOP=1 -q -c "select pg_advisory_lock(9500501); select pg_sleep(1.5); select pg_advisory_unlock(9500501);" &
BARRIER1_PID=$!
sleep 0.3

WORKER_PIDS=()
for w in 1 2 3 4; do
  (
    set +e
    psql -v ON_ERROR_STOP=1 -tA >"${TMP_DIR}/race1_${w}.out" 2>"${TMP_DIR}/race1_${w}.err" <<SQL
select pg_advisory_lock_shared(9500501);
select pg_advisory_unlock_shared(9500501);
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
select public.offer_next_professional('${TRADE_ID}', '${AREA_ID}');
commit;
SQL
    echo $? > "${TMP_DIR}/race1_${w}.rc"
  ) &
  WORKER_PIDS+=($!)
done

wait "$BARRIER1_PID"
for pid in "${WORKER_PIDS[@]}"; do
  wait "$pid"
done

RACE1_OK=0
RACE1_REJECTED=0
for w in 1 2 3 4; do
  rc="$(cat "${TMP_DIR}/race1_${w}.rc")"
  if [[ "$rc" == "0" ]]; then
    RACE1_OK=$((RACE1_OK + 1))
  else
    if grep -q "No vacancy available" "${TMP_DIR}/race1_${w}.err"; then
      RACE1_REJECTED=$((RACE1_REJECTED + 1))
    else
      echo "Race 1 worker ${w} failed with unexpected error:" >&2
      cat "${TMP_DIR}/race1_${w}.err" >&2
      exit 1
    fi
  fi
done

echo "  Race 1 result: ${RACE1_OK} succeeded, ${RACE1_REJECTED} cleanly rejected with 'No vacancy available'"
if [[ "$RACE1_OK" -ne 1 || "$RACE1_REJECTED" -ne 3 ]]; then
  echo "FAIL: Expected 1 success and 3 capacity rejections in Race 1" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -q <<SQL
do \$assert1\$
declare
  v_open_offers integer;
  v_offered_app uuid;
begin
  select count(*) into v_open_offers
  from public.vacancy_offers
  where trade_id = '${TRADE_ID}' and area_id = '${AREA_ID}' and status = 'offered';
  if v_open_offers <> 1 then
    raise exception 'Expected exactly 1 open offer after Race 1, found %', v_open_offers;
  end if;
  select application_id into v_offered_app
  from public.vacancy_offers
  where trade_id = '${TRADE_ID}' and area_id = '${AREA_ID}' and status = 'offered';
  if v_offered_app <> '${APP5_ID}' then
    raise exception 'Expected highest-scoring Pro 5 to win Race 1 offer, got %', v_offered_app;
  end if;
end
\$assert1\$;
SQL

echo "[3/4] Race 2: 2 concurrent admin sessions racing activate_professional() for final slot #5..."
# Pro 5 accepts their offer; also inject a competing accepted offer for Pro 6 to stress-test
# simultaneous activate_professional() defence-in-depth locking for the single remaining slot.
psql -v ON_ERROR_STOP=1 -q <<SQL
do \$prep2\$
declare v_offer uuid;
begin
  select id into v_offer from public.vacancy_offers
  where application_id = '${APP5_ID}' and status = 'offered' limit 1;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '${PRO5_ID}', true);
  perform public.respond_to_vacancy_offer(v_offer, true);
end
\$prep2\$;

insert into public.vacancy_offers(application_id, trade_id, area_id, status, answered_at)
  values ('${APP6_ID}', '${TRADE_ID}', '${AREA_ID}', 'accepted', now());
SQL

psql -v ON_ERROR_STOP=1 -q -c "select pg_advisory_lock(9500502); select pg_sleep(1.5); select pg_advisory_unlock(9500502);" &
BARRIER2_PID=$!
sleep 0.3

(
  set +e
  psql -v ON_ERROR_STOP=1 -tA >"${TMP_DIR}/race2_a.out" 2>"${TMP_DIR}/race2_a.err" <<SQL
select pg_advisory_lock_shared(9500502);
select pg_advisory_unlock_shared(9500502);
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
select public.activate_professional('${APP5_ID}');
commit;
SQL
  echo $? > "${TMP_DIR}/race2_a.rc"
) &
PID_A=$!

(
  set +e
  psql -v ON_ERROR_STOP=1 -tA >"${TMP_DIR}/race2_b.out" 2>"${TMP_DIR}/race2_b.err" <<SQL
select pg_advisory_lock_shared(9500502);
select pg_advisory_unlock_shared(9500502);
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
select public.activate_professional('${APP6_ID}');
commit;
SQL
  echo $? > "${TMP_DIR}/race2_b.rc"
) &
PID_B=$!

wait "$BARRIER2_PID"
wait "$PID_A"
wait "$PID_B"

RACE2_OK=0
RACE2_REJECTED=0
for side in a b; do
  rc="$(cat "${TMP_DIR}/race2_${side}.rc")"
  if [[ "$rc" == "0" ]]; then
    RACE2_OK=$((RACE2_OK + 1))
  else
    if grep -q "No free slot" "${TMP_DIR}/race2_${side}.err"; then
      RACE2_REJECTED=$((RACE2_REJECTED + 1))
    else
      echo "Race 2 worker ${side} failed with unexpected error:" >&2
      cat "${TMP_DIR}/race2_${side}.err" >&2
      exit 1
    fi
  fi
done

echo "  Race 2 result: ${RACE2_OK} won slot #5, ${RACE2_REJECTED} cleanly rejected with 'No free slot'"
if [[ "$RACE2_OK" -ne 1 || "$RACE2_REJECTED" -ne 1 ]]; then
  echo "FAIL: Expected 1 winner and 1 'No free slot' rejection in Race 2" >&2
  exit 1
fi

echo "[4/4] Asserting strict 5-slot cap and waitlist preservation after parallel races..."
psql -v ON_ERROR_STOP=1 -q <<SQL
do \$assert2\$
declare
  v_active_count integer;
  v_app5_active boolean;
  v_app6_active boolean;
begin
  select count(*) into v_active_count
  from public.active_allocations
  where trade_id = '${TRADE_ID}' and area_id = '${AREA_ID}';
  if v_active_count <> 5 then
    raise exception 'Five-slot invariant broken after concurrency race: % active slots', v_active_count;
  end if;

  v_app5_active := public.is_active_approved_application('${APP5_ID}');
  v_app6_active := public.is_active_approved_application('${APP6_ID}');
  if v_app5_active = v_app6_active then
    raise exception 'Expected exactly one of Pro 5 / Pro 6 active (got pro5=%, pro6=%)', v_app5_active, v_app6_active;
  end if;
end
\$assert2\$;
SQL

echo "Five-slot parallel PostgreSQL concurrency test passed (Race 1: 1/4 won; Race 2: 1/2 won; active_allocations = 5)"
