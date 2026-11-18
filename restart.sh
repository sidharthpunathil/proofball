#!/usr/bin/env bash
#
# Restart ProofBall. By default it bounces ONLY the app process; local D1 data
# in .wrangler/state is kept. Any start flags are forwarded through to ./start.sh.
#
#   ./restart.sh                 # restart the dev server (default :31415)
#   ./restart.sh --port 4000     # …on a different port
#   ./restart.sh --prod          # rebuild + restart the production server
#   ./restart.sh --all           # full stop → start
#
set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }

# --all is ours (full stop → start); everything else is a start flag we
# pass straight through to ./start.sh. Kept bash-3.2 safe for macOS's stock shell.
full=0
args=()
for a in "$@"; do
  if [ "$a" = "--all" ]; then full=1; else args+=("$a"); fi
done

log "Restarting ProofBall…"
if [ "$full" = "1" ]; then
  ./stop.sh
else
  ./stop.sh --app-only
fi
./start.sh ${args[@]+"${args[@]}"}
