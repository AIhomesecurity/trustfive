#!/usr/bin/env bash
# Cloudflare Access + Worker commit verification.
#
# Usage:
#   PREVIEW_BASE_URL=https://trustfive-preview.example.workers.dev \
#   CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... \
#   EXPECTED_COMMIT_SHA=9f04780... \
#   bash scripts/release/verify-cloudflare-access.sh
set -euo pipefail

BASE_URL="${PREVIEW_BASE_URL:-}"
CLIENT_ID="${CF_ACCESS_CLIENT_ID:-}"
CLIENT_SECRET="${CF_ACCESS_CLIENT_SECRET:-}"
EXPECTED_SHA="${EXPECTED_COMMIT_SHA:-}"

if [[ -z "$BASE_URL" || -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "ERROR: Set PREVIEW_BASE_URL, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET." >&2
  exit 2
fi

echo "=== Cloudflare Access + Worker commit verification ==="
echo "Preview URL: $BASE_URL"
echo "Expected commit SHA: ${EXPECTED_SHA:-<not set>}"
echo ""

PASS=0; FAIL=0

# Check 1: Anonymous visitor blocked.
echo -n "1. Anonymous visitor blocked by Cloudflare Access... "
ANON_RESPONSE=$(curl -s -o /tmp/cf-anon-body.txt -w "%{http_code}" --max-time 15 --location "$BASE_URL/" 2>/dev/null) || ANON_RESPONSE="000"
ANON_BODY=$(cat /tmp/cf-anon-body.txt 2>/dev/null || echo ""); rm -f /tmp/cf-anon-body.txt
if [[ "$ANON_RESPONSE" == "302" || "$ANON_RESPONSE" == "401" || "$ANON_RESPONSE" == "403" ]]; then
  if echo "$ANON_BODY" | grep -qiE "My jobs and quotes|TrustFive Social"; then
    echo "FAIL"; FAIL=$((FAIL + 1))
  else
    echo "PASS (HTTP $ANON_RESPONSE)"; PASS=$((PASS + 1))
  fi
else
  echo "FAIL (got $ANON_RESPONSE)"; FAIL=$((FAIL + 1))
fi

# Check 2: Service token reaches health.
echo -n "2. Service token reaches Worker health endpoint... "
HEALTH_RESPONSE=$(curl -s -o /tmp/cf-health-body.txt -w "%{http_code}" --max-time 15 \
  -H "CF-Access-Client-Id: $CLIENT_ID" -H "CF-Access-Client-Secret: $CLIENT_SECRET" \
  "$BASE_URL/api/health" 2>/dev/null) || HEALTH_RESPONSE="000"
if [[ "$HEALTH_RESPONSE" != "200" ]]; then
  echo "FAIL (HTTP $HEALTH_RESPONSE)"; FAIL=$((FAIL + 1)); echo ""; echo "=== $PASS passed, $FAIL failed ==="; exit 1
fi
HEALTH_BODY=$(cat /tmp/cf-health-body.txt 2>/dev/null || echo ""); rm -f /tmp/cf-health-body.txt
echo "PASS (HTTP 200)"; PASS=$((PASS + 1))

# Check 3: Health has service=trustfive-web, status=ok.
echo -n "3. Health has service=trustfive-web status=ok... "
SERVICE=$(echo "$HEALTH_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('service',''))" 2>/dev/null || echo "")
STATUS=$(echo "$HEALTH_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")
if [[ "$SERVICE" == "trustfive-web" && "$STATUS" == "ok" ]]; then
  echo "PASS"; PASS=$((PASS + 1))
else
  echo "FAIL (service=$SERVICE status=$STATUS)"; FAIL=$((FAIL + 1))
fi

# Check 4: Commit SHA matches.
if [[ -n "$EXPECTED_SHA" ]]; then
  echo -n "4. Health reports expected commit SHA... "
  REPORTED_SHA=$(echo "$HEALTH_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('commit',''))" 2>/dev/null || echo "")
  if [[ -z "$REPORTED_SHA" ]]; then
    echo "FAIL (no commit field)"; FAIL=$((FAIL + 1))
  elif [[ "$REPORTED_SHA" == "$EXPECTED_SHA" ]]; then
    echo "PASS (commit=$REPORTED_SHA)"; PASS=$((PASS + 1))
  else
    echo "FAIL (expected $EXPECTED_SHA, got $REPORTED_SHA)"; FAIL=$((FAIL + 1))
  fi
fi

# Check 5: Anonymous cannot reach /api/health.
echo -n "5. Anonymous cannot reach /api/health... "
ANON_HEALTH=$(curl -s -o /tmp/cf-anon-health.txt -w "%{http_code}" --max-time 15 "$BASE_URL/api/health" 2>/dev/null) || ANON_HEALTH="000"
ANON_HEALTH_BODY=$(cat /tmp/cf-anon-health.txt 2>/dev/null || echo ""); rm -f /tmp/cf-anon-health.txt
if [[ "$ANON_HEALTH" == "302" || "$ANON_HEALTH" == "401" || "$ANON_HEALTH" == "403" ]]; then
  if echo "$ANON_HEALTH_BODY" | grep -q '"service":"trustfive-web"'; then
    echo "FAIL (health JSON served anonymously)"; FAIL=$((FAIL + 1))
  else
    echo "PASS"; PASS=$((PASS + 1))
  fi
else
  echo "FAIL (got $ANON_HEALTH)"; FAIL=$((FAIL + 1))
fi

echo ""; echo "=== Summary: $PASS passed, $FAIL failed ==="
[[ $FAIL -gt 0 ]] && exit 1
exit 0
