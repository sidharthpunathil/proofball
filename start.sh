#!/usr/bin/env bash
#
# Start ProofBall locally, end to end:
#   1. npm install            (only if node_modules is missing)
#   2. docker compose up -d    Postgres (:55432) + Redis (:63799)
#   3. npm run matches:sync    populate the finished-match cache from TxLINE
#   4. npm run dev             Next.js server, backgrounded → http://localhost:31415
#
# The app degrades gracefully with no Docker, so a missing daemon is a warning,
# not a hard stop (you just get fewer past matches + a local-only leaderboard).
#
#   ./start.sh                 # dev server on :31415 (a deliberately odd default,
#                              #   so it never fights another dev server on :3000)
#   ./start.sh --prod          # production build + `next start`
#   PORT=4000 ./start.sh       # pin a different port…
#   ./start.sh --port 4000     # …or pass it inline
#   ./restart.sh               # bounce just the app (keeps Postgres/Redis up)
#   ./stop.sh                  # tear it all back down
#
# Pinning the port keeps the URL stable across restarts — an old browser tab on
# a since-dead port is a classic source of "Loading chunk … failed".
#
set -euo pipefail
cd "$(dirname "$0")"

MODE="dev"
# A deliberately odd default port: this repo often has a second dev server
# running (the concurrent workstream sits on :3000/:3100), and two servers on the
# same port just fail to bind. Override with PORT=… or --port anytime.
PORT="${PORT:-31415}"
while [ $# -gt 0 ]; do
  case "$1" in
    --prod) MODE="prod" ;;
    --port) shift; PORT="${1:?--port needs a number}" ;;
    --port=*) PORT="${1#*=}" ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# Isolate everything this local server touches from a second dev server in the
# same repo — the classic cause of corrupt builds / "Loading chunk … failed":
#   • NEXT_DIST_DIR → its own build dir, so two `next dev` never share .next
#   • WS_NO_* → silence the node-v25 `ws` native addon so on-chain mints
#     (airdrop / win) confirm locally instead of hanging on signatureSubscribe
# All three stay overridable from the environment.
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-run}"
export WS_NO_BUFFER_UTIL="${WS_NO_BUFFER_UTIL:-1}"
export WS_NO_UTF_8_VALIDATE="${WS_NO_UTF_8_VALIDATE:-1}"

RUN_DIR=".run"
APP_PID_FILE="$RUN_DIR/app.pid"
APP_LOG="$RUN_DIR/app.log"
mkdir -p "$RUN_DIR"

log() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }

# Already up? Don't spawn a second server on the same port.
if [ -f "$APP_PID_FILE" ] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
  log "ProofBall is already running (pid $(cat "$APP_PID_FILE")). Run ./stop.sh first."
  exit 0
fi

# 1. Dependencies
if [ ! -d node_modules ]; then
  log "Installing dependencies (npm install)…"
  npm install
fi

# 2. Data stores + 3. cache sync — best-effort, gated on a working Docker daemon.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log "Starting Postgres + Redis (docker compose up -d)…"
  docker compose up -d --wait 2>/dev/null || docker compose up -d
  log "Syncing finished-match cache (npm run matches:sync)…"
  npm run matches:sync || log "matches:sync failed — continuing (past matches may be sparse)."
else
  log "Docker not available — skipping DB/Redis. App runs with graceful fallbacks."
fi

# 4. App — backgrounded, with its pid recorded so ./stop.sh can find it.
if [ "$MODE" = "prod" ]; then
  log "Building (npm run build)…"
  npm run build
  log "Starting production server on :$PORT (npm run start)…"
  nohup npm run start -- -p "$PORT" >"$APP_LOG" 2>&1 &
else
  log "Starting dev server on :$PORT (npm run dev)…"
  nohup npm run dev -- -p "$PORT" >"$APP_LOG" 2>&1 &
fi
echo $! >"$APP_PID_FILE"

log "ProofBall started (pid $(cat "$APP_PID_FILE")) → http://localhost:$PORT"
log "Logs:     tail -f $APP_LOG"
log "Restart:  ./restart.sh"
log "Stop:     ./stop.sh"
