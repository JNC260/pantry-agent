## Local development

Three packages, one npm workspace — each has its own README with the full
list of required environment variables:

- [`pantry-agent/`](./pantry-agent/README.md) — Mastra app (`npm run dev`, Studio at `localhost:4111`)
- [`api/`](./api/README.md) — NestJS (`npm run start:dev`, `localhost:3000`)
- [`web/`](./web/README.md) — Next.js (`npm run dev`, `localhost:3001`)

All three need to be running for the full app to work end to end.
