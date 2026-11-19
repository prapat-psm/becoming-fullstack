# Roombook

Roombook is a meeting-room booking app and a hands-on project for a Senior Frontend Engineer moving into full-stack product ownership. The core exercise is shipping and operating a reliable booking flow across React, NestJS, and PostgreSQL.

## Run locally

Install Node.js 24 and Docker with Compose. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), then run these commands from the repo root.

```sh
docker compose up -d --wait db
npm ci
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Open `http://127.0.0.1:3000`. Sign in as `member@example.test` with `DEMO_PASSWORD` from `.env`, or as `admin@example.test` with `DEMO_ADMIN_PASSWORD`. Search for a future window, book an available room, then visit **My bookings** to cancel it. The administrator can add and edit rooms under **Manage rooms**.

For development, run `npm run dev:api` and `npm run dev:web` in separate terminals and open the Vite URL. To run both services in containers, use `docker compose --profile app up --build -d --wait` and then `docker compose exec app npm run db:seed`. To use an existing PostgreSQL 17 server, set the URLs in `.env` to a database that allows the `btree_gist` extension and skip Docker.

## Verify and operate

```sh
npm run build
npm test
npm run db:explain
```

Tests require real PostgreSQL and a `TEST_DATABASE_URL` whose user can create schemas. The suite applies migrations in a disposable schema and drops that schema after use. It may install `btree_gist` in the test database, so use a local or dedicated test database. GitHub Actions runs the same build and test commands against PostgreSQL 17.

- The browser renders times in its local timezone. REST endpoints exchange UTC timestamps and bookings use half-open intervals `[start, end)`.
- Availability is a snapshot. The PostgreSQL exclusion constraint is authoritative at write time, and the API returns `409` if another request already took the slot.
- The API uses a same-origin session cookie, stores token hashes in PostgreSQL, and checks permissions and booking ownership on the server. The member and admin accounts are seeded for a demo.
- The API provides `GET /api/health`, `GET /api/rooms` with optional `startsAt` and `endsAt`, `POST /api/rooms` and `PATCH /api/rooms/:id` for admins, `GET/POST/DELETE /api/session`, `GET/POST /api/bookings`, and `DELETE /api/bookings/:id` for owners of upcoming bookings.

## Project guides

- [Full-stack roadmap and application evidence](docs/ROADMAP.md)
- [Project creation log and PowerShell command examples](docs/BUILD-LOG.md)
- [Deploy, release, and incident runbook](docs/OPERATIONS.md)
- [Reference case study and demo outline](docs/CASE-STUDY.md)
- [Career options for working with and delivering AI systems](docs/AI-CAREER.md)
- [Git attribution rules for commits, PRs, and MRs](AGENTS.md)
