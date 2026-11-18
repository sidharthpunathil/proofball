#!/usr/bin/env bash
#
# Stop what ./start.sh brought up: the Next.js server (whole process tree).
# Local D1/R2 data persists in .wrangler/state.
#
#   ./stop.sh            # stop the app (keep local data)
#   ./stop.sh --app-only # same thing; kept so ./restart.sh keeps working
#   ./stop.sh --volumes  # also delete the local D1/R2 state for a fresh slate
#
set -euo pipefail
cd "$(dirname "$0")"

RUN_DIR=".run"
APP_PID_FILE="$RUN_DIR/app.pid"

log() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }

# Flags are order-independent. --app-only skips the data cleanup entirely.
APP_ONLY=0
VOLUMES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --app-only) APP_ONLY=1 ;;
    --volumes) VOLUMES=1 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# npm spawns `next` as a child, so signalling only the npm pid can orphan the
# server. Walk the tree depth-first and signal every descendant.
kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

# 1. App
if [ -f "$APP_PID_FILE" ]; then
  pid="$(cat "$APP_PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping ProofBall server (pid $pid)…"
    kill_tree "$pid"
    # Give it a moment to exit cleanly, then force any stragglers.
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.3; done
    kill -0 "$pid" 2>/dev/null && kill_tree "$pid" && sleep 0.3 || true
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  else
    log "Recorded server (pid $pid) is not running."
  fi
  rm -f "$APP_PID_FILE"
else
  log "No app pidfile — server not tracked (skipping)."
fi

# 2. Local data (only with --volumes).
if [ "$APP_ONLY" != "1" ] && [ "$VOLUMES" = "1" ]; then
  log "Deleting local D1/R2 state (.wrangler/state)…"
  rm -rf .wrangler/state
fi

log "ProofBall stopped."
