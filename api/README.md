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

There's no user table — this is single-user by design (see the root README for why). `JwtAuthGuard` protects every route above except login.

## Running it

```bash
npm install
npm run start:dev   # watch mode, localhost:3000
npm run build
npm run start:prod
```

Both `pantry-agent/` (`npm run dev`) and this need to be running for `/chat` to work locally.

## Environment variables

```
PORT=3000                          # defaults to 3000 if unset; hosting
                                    # platforms typically inject this
WEB_ORIGIN=http://localhost:3001   # CORS allow-list, the frontend's origin

JWT_SECRET=
AUTH_PASSWORD=                     # despite the name, this must be a
                                    # bcrypt HASH, not a plaintext password
                                    # — generate with bcrypt, compared via
                                    # bcrypt.compare() in auth.controller.ts

MASTRA_SERVER_URL=http://localhost:4111   # where the Mastra app is running

PANTRY_DB_URL=
PANTRY_DB_AUTH_TOKEN=
```
