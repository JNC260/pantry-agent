# api

The NestJS backend: authentication and pantry CRUD, and the only thing allowed to talk to the Mastra server (`pantry-agent/`). See the [root README](../README.md) for the full project overview and architecture.

## Routes

| Route                | Auth | Purpose                                                                                  |
| -------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `POST /auth/login`   | —    | Single-user login (password checked against a bcrypt hash, returns a JWT)                |
| `POST /chat`         | JWT  | Relays a message + conversation history to the Mastra agent over HTTP, returns its reply |
| `GET /pantry`        | JWT  | List pantry items                                                                        |
| `POST /pantry`       | JWT  | Create a pantry item                                                                     |
| `PATCH /pantry/:id`  | JWT  | Update a pantry item                                                                     |
| `DELETE /pantry/:id` | JWT  | Delete a pantry item                                                                     |
| `GET /health`        | —    | Liveness check for the deploy platform                                                   |

There's no user table — this is single-user by design (see the root README for why). `JwtAuthGuard` protects every route above except login and health. Login is rate-limited to 5 attempts per minute per IP.

## Running it

```bash
npm run start:dev   # watch mode, localhost:3000
npm run build
npm run start:prod
npm test            # unit tests
npm run test:e2e    # e2e tests against an in-memory database
npm run typecheck
```

Both `pantry-agent/` (`npm run dev`) and this need to be running for `/chat`
to work locally.

## Environment variables

See [`.env.example`](./.env.example). The api refuses to start without
`AUTH_PASSWORD_HASH` (a bcrypt hash of the login password, not the password
itself), `JWT_SECRET`, and `PANTRY_DB_URL`.
