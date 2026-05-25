#!/usr/bin/env bash
# Fails if any file under app/ or components/ imports @/lib/db without an
# explicit 'use server' / 'server-only' marker. Protects the browser bundle.
set -euo pipefail

ROOTS=("app" "components")
PATTERN='from ["'"'"']@/lib/db'

bad=0
for root in "${ROOTS[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r file; do
    head -n 5 "$file" | grep -qE "^['\"](use server|server-only)['\"]" && continue
    [[ "$file" =~ /route\.(t|j)sx?$ ]] && continue
    [[ "$file" =~ /api/ ]] && continue
    echo "ERROR: $file imports @/lib/db without 'use server' or 'server-only' marker"
    bad=1
  done < <(grep -rlE "$PATTERN" "$root" --include='*.ts' --include='*.tsx' 2>/dev/null || true)
done

if [[ $bad -ne 0 ]]; then
  echo "Drizzle/Postgres MUST NOT leak into the client bundle."
  exit 1
fi
echo "OK — no client-side imports of @/lib/db."
