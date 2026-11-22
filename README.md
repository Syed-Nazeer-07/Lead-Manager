# Leadspace — Lead Manager

A focused, full-stack lead-management app built for the **Meru Technosoft Full Stack Developer screening assignment**. Capture prospects, track their status, and keep a clear overview of the sales pipeline.

## Features

- Create, read, update, and delete leads with a confirmation before deletion.
- Name, email, phone, company, source, and status, with validation **on both the client and server**.
- Search leads by name, email, or company; filter by status.
- Sort by newest, oldest, name, or company; 10 leads per page.
- Live pipeline counts for total leads and each status.
- Mobile-friendly table/cards, loading/empty/error states, accessible forms, keyboard-closeable dialogs.
- SQLite database with indexes and parameterized queries.
- API integration tests covering CRUD, validation, filtering, pagination, and status counts.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 | Fast, component-based UI; small bundle and straightforward development |
| Backend | Node.js + Express 5 | Simple REST API with predictable middleware and error handling |
| Database | SQLite using Node.js `node:sqlite` | Small, embedded, file-backed database; no separate database server needed |
| UI | Custom CSS + Lucide React | Responsive design without a heavy component framework |
| Tests | Node.js built-in test runner | Lightweight API integration coverage |

**Prerequisite:** Node.js **22.16+** and npm. SQLite is provided through `node:sqlite`, which may print an experimental warning on Node 22; newer Node 24 versions reduce that concern.

## Local setup

```bash
git clone https://github.com/Syed-Nazeer-07/Lead-Manager.git
cd Lead-Manager
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health

The database is created automatically at `./data/leads.sqlite` when the backend first runs. **Do not commit** local database files or `.env` files. The app starts with an empty pipeline by design.

Note: the backend reads `PORT` and `DB_PATH` from process environment variables. `.env.example` documents supported variables; it is not automatically loaded. For non-default settings, export environment variables before starting the app.

## Build and test

```bash
npm test           # API integration tests (temporary isolated SQLite database)
npm run build      # Production frontend build
npm start          # Serve API and built frontend on port 4000
```

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health |
| GET | `/api/meta` | Allowed sources and statuses |
| GET | `/api/leads` | Paginated list; `search`, `status`, `sort`, `page`, `pageSize` |
| GET | `/api/leads/stats` | Total and counts by status |
| GET | `/api/leads/:id` | Get a lead |
| POST | `/api/leads` | Create a lead |
| PUT | `/api/leads/:id` | Update a lead |
| DELETE | `/api/leads/:id` | Delete a lead |

Lead payload example:

```json
{
  "name": "Aisha Khan",
  "email": "aisha@example.com",
  "phone": "+91 98765 43210",
  "company": "Aurora Labs",
  "source": "Referral",
  "status": "New"
}
```

Allowed sources: `Website`, `Referral`, `LinkedIn`, `Cold Outreach`, `Other`. Allowed statuses: `New`, `Contacted`, `Qualified`, `Lost`.

Successful creation returns **201**, deletion **204**; invalid input returns **422** with field errors, invalid query parameters **400**, and missing leads **404**.

## Assumptions and scope

- This is a **single-user** take-home MVP; authentication and permissions are intentionally deferred because they are optional in the assignment.
- Leads may share an email address (different campaigns or contacts can reference the same address).
- Server-side sorting uses a fixed allowlist, and SQL values are parameterized.
- Leads are initially empty; no fabricated demo records are inserted.
- The SQLite database needs **persistent storage** when deployed. A platform with an ephemeral filesystem can lose leads on restart. For production use, migrate to managed PostgreSQL or configure a persistent disk.

## Improvements with more time

1. Authentication with per-user authorization, hashed passwords, and sessions.
2. Production deployment with PostgreSQL, a migration system, backups, and observability.
3. E2E browser tests and keyboard focus trapping in dialogs.
4. Import/export CSV, duplicate detection, and richer follow-up activity history.

## Notes

Most important engineering decision: prioritize a reliable CRUD flow and explicit backend validation over optional feature complexity. The UI treats zero results, API failures, and destructive actions as first-class states instead of happy-path-only cases.
