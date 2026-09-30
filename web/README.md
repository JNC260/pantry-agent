# web

The Next.js frontend: public landing page, login, chat, and pantry management. See the [root README](../README.md) for the full project overview and architecture.

## Pages

| Route     | Auth                       | Purpose                                                                                                 |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`       | —                          | Public landing page (demo video, repo link, login)                                                      |
| `/login`  | —                          | Single-user login                                                                                       |
| `/chat`   | JWT (client-side redirect) | Recipe recommendation chat                                                                              |
| `/pantry` | JWT (client-side redirect) | Pantry inventory — view, search, filter, add (including bulk add via a modal), edit, delete, categorize |

The JWT is stored in `localStorage`; every authenticated request goes through the shared `authedFetch` helper (`src/lib/api.ts`), which redirects to `/login` on a 401. Conversation history on `/chat` also persists to `localStorage`, so switching tabs or refreshing doesn't lose an in-progress conversation.

## Running it

```bash
npm install
npm run dev     # localhost:3001
npm run build
npm run start
```

`api/` (and, for `/chat`, `pantry-agent/` behind it) needs to be running for anything past the landing page to actually work.

## Environment variables

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

That's the only one — this app never talks to Pinterest, Turso, or Mastra directly, only to `api/`.
