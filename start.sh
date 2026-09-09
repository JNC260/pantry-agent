  #!/bin/sh
  set -e

  (cd pantry-agent/pantry-agent && node .mastra/output/index.mjs) &
  cd api && node dist/main.js