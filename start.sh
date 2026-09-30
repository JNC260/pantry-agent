#!/bin/sh
# Runs pantry-agent and api side by side. If either one exits, stop the other
# and exit non-zero so Railway's restart policy restarts the whole service
# (otherwise a crashed pantry-agent goes unnoticed while api keeps running).

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

(cd "$SCRIPT_DIR/pantry-agent" && PORT=4111 exec node .mastra/output/index.mjs) &
AGENT_PID=$!
(cd "$SCRIPT_DIR/api" && exec node dist/main.js) &
API_PID=$!

shutdown() {
  kill "$AGENT_PID" "$API_PID" 2>/dev/null
  wait "$AGENT_PID" "$API_PID" 2>/dev/null
}

# Railway sends SIGTERM on redeploy/stop; pass it on so both exit cleanly.
trap 'shutdown; exit 0' TERM INT

while kill -0 "$AGENT_PID" 2>/dev/null && kill -0 "$API_PID" 2>/dev/null; do
  # backgrounded so the TERM trap runs immediately instead of after the sleep
  sleep 5 &
  wait $!
done

if kill -0 "$AGENT_PID" 2>/dev/null; then
  echo "[start.sh] api exited; stopping pantry-agent" >&2
else
  echo "[start.sh] pantry-agent exited; stopping api" >&2
fi
shutdown
exit 1
