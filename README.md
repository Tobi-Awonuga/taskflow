# Nectar

Internal operational workflow platform — department-scoped task management with RBAC, audit logging, and session-based auth.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + Tailwind CSS |
| Backend | Node.js + Express (CommonJS) |
| Database | MySQL 8 via Drizzle ORM + mysql2 |
| Auth | Cookie-based DB-backed sessions |

---

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (for MySQL)

---

## 1 — Start MySQL with Docker

```bash
docker run --name nectar-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=nectar \
  -e MYSQL_USER=nectar \
  -e MYSQL_PASSWORD=nectarpass \
  -p 3306:3306 \
  -d mysql:8
```

> On Windows PowerShell, replace `\` line continuations with `` ` ``.

---

## 2 — Configure environment

```bash
cd server
cp .env.example .env
```

The default `.env.example` values already match the Docker command above — no edits needed for local dev.

---

## 3 — Install, migrate, seed

```bash
cd server
npm install
npm run migrate
npm run seed
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Dev accounts

| Email | Password | Role |
|-------|----------|------|
| admin@taskflow.com | admin123 | ADMIN |
| super@taskflow.com | super123 | SUPER |
| user@taskflow.com | user123 | USER |

---

## NPM scripts (server)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API server with nodemon (port 3001) |
| `npm run start` | Start API server (production) |
| `npm run migrate` | Apply Drizzle migrations to MySQL |
| `npm run seed` | Seed departments, users, and sample tasks |
| `npm run db:reset` | Drop + recreate DB, re-migrate, re-seed (fresh start) |
| `npm run generate` | Regenerate Drizzle migration files after schema changes |
| `npm test` | Run test suite (vitest + supertest) |

---

## Reset the database

Wipes everything and starts fresh:

```bash
cd server
npm run db:reset
```

---

## Running tests

```bash
cd server
npm test
```

Tests run against a separate test database (`nectar_test`). Make sure your MySQL Docker container is running before running tests.

---

## Project structure

```
taskflow/
├── client/                  # Vite + React frontend
│   ├── public/              # Static assets (place nectar-bg.mp4 here)
│   └── src/react/
│       ├── pages/           # Route-level page components
│       ├── components/      # Shared UI components
│       ├── context/         # AuthContext, ToastContext
│       └── hooks/           # useTasks, etc.
└── server/                  # Express API
    ├── drizzle/             # Generated SQL migrations
    ├── scripts/             # migrate.js, seed.js, reset-db.js
    └── src/
        ├── db/              # schema.js, client.js
        ├── lib/             # sessions, audit, rbac, password, mailer
        ├── middleware/      # requireAuth, requireRole
        ├── routes/          # auth, tasks, users, departments, comments, audit
        └── utils/           # asyncHandler, datetime
```

---

## Roles

| Role | Permissions |
|------|-------------|
| `ADMIN` | Full access — all departments, all tasks, user management |
| `SUPER` | Own department tasks + org-wide null-dept tasks |
| `USER` | Own department tasks — can only self-assign |
