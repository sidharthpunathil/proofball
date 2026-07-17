#!/usr/bin/env bash
#
# Stop everything ./start.sh brought up: the Next.js server (whole process tree)
# and the Docker data stores. Postgres/Redis data persists in named volumes.
#
#   ./stop.sh            # stop app + `docker compose down` (keep data)
#   ./stop.sh --volumes  # also delete DB/Redis volumes for a fresh slate
#
set -euo pipefail
cd "$(dirname "$0")"

RUN_DIR=".run"
APP_PID_FILE="$RUN_DIR/app.pid"

log() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }

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

# 2. Data stores
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if [ "${1:-}" = "--volumes" ]; then
    log "Stopping Postgres + Redis and deleting volumes (docker compose down -v)…"
    docker compose down -v
  else
    log "Stopping Postgres + Redis (docker compose down)…"
    docker compose down
  fi
else
  log "Docker not available — nothing to stop there."
fi

log "ProofBall stopped."
