#!/bin/sh
set -e

(cd pantry-agent/pantry-agent && PORT=4111 node .mastra/output/index.mjs) &
cd api && node dist/main.js