#!/usr/bin/env bash
# Preview database readiness checker (Issue #180 / PR #181).
#
# Runs 17 schema readiness checks against a Supabase project and reports
# which pass / fail. Designed to be run by an operator with psql access to
# the preview Supabase project.
#
# Usage:
#   PREVIEW_DB_URL='postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres' \
#     bash scripts/db/check-preview-readiness.sh
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not installed." >&2
  exit 2
fi
if [[ -z "${PGHOST:-}" && -z "${PREVIEW_DB_URL:-}" ]]; then
  echo "ERROR: Set PREVIEW_DB_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE." >&2
  exit 2
fi

PSQL_ARGS=()
if [[ -n "${PREVIEW_DB_URL:-}" ]]; then
  PSQL_ARGS+=("$PREVIEW_DB_URL")
fi

READINESS_SQL=$(cat <<'SQL'
WITH checks AS (
  SELECT 1 AS n, 'auth.users table exists' AS name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users') AS passed,
    '' AS reason
  UNION ALL SELECT 2, 'public.profiles table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'), ''
  UNION ALL SELECT 3, 'public.trades table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trades'), ''
  UNION ALL SELECT 4, 'public.service_areas table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='service_areas'), ''
  UNION ALL SELECT 5, 'public.professional_applications table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='professional_applications'), ''
  UNION ALL SELECT 6, 'public.professional_verification_submissions table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='professional_verification_submissions'), ''
  UNION ALL SELECT 7, 'public.active_allocations table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='active_allocations'), ''
  UNION ALL SELECT 8, 'public.vacancy_offers table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vacancy_offers'), ''
  UNION ALL SELECT 9, 'public.jobs table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs'), ''
  UNION ALL SELECT 10, 'public.job_bookings table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_bookings'), ''
  UNION ALL SELECT 11, 'public.job_site_locations table exists with RLS',
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname='job_site_locations' AND c.relrowsecurity), ''
  UNION ALL SELECT 12, 'public.booking_address_consent_events table exists with RLS',
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname='booking_address_consent_events' AND c.relrowsecurity), ''
  UNION ALL SELECT 13, 'public.community_posts table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='community_posts'), ''
  UNION ALL SELECT 14, 'public.community_comments table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='community_comments'), ''
  UNION ALL SELECT 15, 'flag_expired_insurance_active_professionals() RPC exists',
    to_regprocedure('public.flag_expired_insurance_active_professionals()') IS NOT NULL, ''
  UNION ALL SELECT 16, 'booking_job_site_address() RPC exists and is SECURITY DEFINER',
    EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.booking_job_site_address(uuid)') AND p.prosecdef), ''
  UNION ALL SELECT 17, 'set_booking_address_sharing() RPC exists and is SECURITY DEFINER',
    EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.set_booking_address_sharing(uuid,boolean)') AND p.prosecdef), ''
)
SELECT n, name, passed, reason FROM checks ORDER BY n;
SQL
)

echo "=== TrustFive preview database readiness checks ==="
echo "Target: ${PREVIEW_DB_URL:-${PGHOST:-localhost}:${PGPORT:-5432}/${PGDATABASE:-postgres}}"
echo ""

RAW=$(psql "${PSQL_ARGS[@]}" -A -t -F $'\t' -c "$READINESS_SQL" 2>&1) || {
  echo "ERROR: psql connection failed." >&2
  echo "$RAW" >&2
  exit 1
}

PASS=0; FAIL=0; FAILED_NAMES=()
printf "%-4s %-60s %-8s %s\n" "#" "Check" "Status" "Reason"
printf "%-4s %-60s %-8s %s\n" "---" "------------------------------------------------------------" "--------" "------"
while IFS=$'\t' read -r n name passed reason; do
  if [[ "$passed" == "t" || "$passed" == "true" ]]; then
    status="PASS"; PASS=$((PASS + 1))
  else
    status="FAIL"; FAIL=$((FAIL + 1)); FAILED_NAMES+=("$name")
  fi
  printf "%-4s %-60s %-8s %s\n" "$n" "$name" "$status" "$reason"
done <<< "$RAW"

echo ""
echo "=== Summary: $PASS passed, $FAIL failed (of 17) ==="
if [[ $FAIL -gt 0 ]]; then
  echo ""; echo "Failed checks:"; for name in "${FAILED_NAMES[@]}"; do echo "  - $name"; done
  exit 1
fi
echo "All 17 readiness checks passed."
exit 0
