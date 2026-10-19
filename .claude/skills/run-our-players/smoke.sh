#!/usr/bin/env bash
# Start the real API on the dev PGlite (apps/server/.data/pglite), check every v1 route answers
# with the right status and CORS, then stop it cleanly (SIGTERM releases the PGlite lock).
# Usage (repo root): .claude/skills/run-our-players/smoke.sh [--keep]   --keep leaves it running.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)/apps/server"
PORT="${PORT:-3001}"
BASE="http://localhost:$PORT"
LOG="${TMPDIR:-/tmp}/our-players-api.log"
LOCK=.data/pglite.lock

if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "dev DB is held by pid $(cat "$LOCK") (pnpm dev:server?) - stop it first" >&2
  exit 1
fi

# Not `pnpm dev:server`: tsx watch SIGKILLs the child 5 s after a signal; plain tsx gets SIGTERM.
setsid ../../node_modules/.bin/tsx src/main.ts >"$LOG" 2>&1 &
for _ in $(seq 1 60); do curl -sf "$BASE/health" >/dev/null && break; sleep 0.5; done
if ! curl -sf "$BASE/health" >/dev/null; then
  echo "API did not come up; log: $LOG" >&2
  cat "$LOG" >&2
  exit 1
fi
echo "API up on $BASE (log: $LOG)"

fail=0
check() { # check <expected-status> <path> [curl args...]
  local want=$1 path=$2
  shift 2
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$BASE$path")
  if [ "$got" = "$want" ]; then echo "ok   $got $path"; else echo "FAIL $got (want $want) $path"; fail=1; fi
}
check 200 /health
check 200 /v1/meta
check 200 "/v1/days/2026-03-16?countries=LVA"
check 400 "/v1/days/2026-03-16?countries=lva"
check 200 "/v1/players/search?q=porz"
check 400 "/v1/players/search?q="
check 200 "/v1/players?ids=nhl-8476878,nba-3102531"
check 404 /v1/players/nhl-999
check 200 /v1/countries
acao=$(curl -s -D - -o /dev/null -H 'Origin: http://localhost:8081' "$BASE/v1/meta" | grep -i '^access-control-allow-origin')
evil=$(curl -s -D - -o /dev/null -H 'Origin: https://evil.example' "$BASE/v1/meta" | grep -ci '^access-control-allow-origin')
if [ -n "$acao" ] && [ "$evil" = 0 ]; then echo "ok   CORS ($(echo "$acao" | tr -d '\r'))"; else echo "FAIL CORS"; fail=1; fi

if [ "${1:-}" = "--keep" ]; then
  echo "left running: pid $(cat "$LOCK"); stop with: kill -TERM \$(cat apps/server/$LOCK)"
else
  kill -TERM "$(cat "$LOCK")"
  for _ in $(seq 1 40); do [ -e "$LOCK" ] || break; sleep 0.25; done
  if [ -e "$LOCK" ]; then echo "lock still held after SIGTERM" >&2; fail=1; else echo "stopped, lock released"; fi
fi
exit $fail
