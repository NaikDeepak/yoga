#!/usr/bin/env bash
# npm run dev:prod-db — local app on http://localhost:3000 against the PRODUCTION database (Neon).
# For debugging real data only: every change you make here is a change to production.
# Reads only PROD_DATABASE_URL from .env (sourcing the whole file would also pick up LOCAL_MOCK=true
# and silently run on mock data).
set -euo pipefail
URL="$(grep -E '^PROD_DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
if [[ -z "$URL" ]]; then
  echo "Error: PROD_DATABASE_URL is not set in .env" >&2
  exit 1
fi
echo ""
echo "  ⚠️  LOCAL APP ON THE PRODUCTION DATABASE — changes here change real client records."
echo "     Bound to localhost only. Ctrl+C to stop."
echo ""
export DATABASE_URL="$URL"
# Empty LOCAL_MOCK wins over .env (Next never overrides variables that are already set).
exec env LOCAL_MOCK= npx next dev -H 127.0.0.1
