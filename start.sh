#!/bin/sh
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

(cd "$SCRIPT_DIR/pantry-agent/pantry-agent" && PORT=4111 node .mastra/output/index.mjs) &
cd "$SCRIPT_DIR/api" && node dist/main.js