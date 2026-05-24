# Greenfields IMS

**Incident Management System** — Track, prioritise, and audit operational incidents in industrial environments.

---

## Quick Start

```bash
# Backend (port 8000)
cd backend
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (port 5173, proxies /api to 8000)
cd frontend
npm install && npm run dev
```

Open `http://localhost:5173` — login with `admin` / `admin123`.

---

## Features

- **Dashboard** — Aggregate stats (total open, critical, unassigned, past-SLA) with attention-prioritised list
- **Incident CRUD** — Create, update, soft-delete with status workflow
- **Severity Levels** — LOW / MEDIUM / HIGH / CRITICAL with per-level SLA thresholds
- **Attention Score** — 0–100 priority algorithm (severity + SLA breach + age + status)
- **Assigned Incidents View** — Operators see only their assigned items
- **Role-Based Access** — Superadmin / Admin (full) / Operator (scoped)
- **Audit Logging** — Immutable trail with JSONB snapshots for every mutation
- **CSV Export** — Streaming download with date range filtering
- **Inline Editing** — Edit incidents directly from dashboard detail modal
- **User Management** — Admin-only CRUD with smart deactivation
- **JWT Auth** — bcrypt hashing + HS256 tokens
- **Lazy Loading** — Route-level chunk splitting for fast first paint

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI 0.104, Python 3.12+, Uvicorn 0.24 |
| **Database** | PostgreSQL 14+ (raw SQL via psycopg2, no ORM) |
| **Frontend** | React 19, Vite 8, TailwindCSS 3.4, React Router 7 |
| **Proxy** | Nginx (reverse proxy + static files + rate limiting) |
| **Process** | systemd (hardened unit with auto-restart) |
| **Infra** | Ubuntu 22.04 LTS, 1 CPU / 2 GB RAM target |

---

## Project Structure

```
greenfields/
├── backend/                  # FastAPI application
│   └── app/
│       ├── api/              # Route handlers — incidents, users, auth, audit_logs
│       ├── core/             # Pydantic config, constants
│       ├── db/               # Threaded connection pool, query helpers
│       ├── migration/        # SQL migrations (performance indexes, seed data)
│       ├── repositories/     # Data access (raw SQL, filter builder)
│       ├── schemas/          # Pydantic request/response models
│       ├── services/         # Business logic — incidents, attention score, audit
│       └── utils/            # JWT, bcrypt, RBAC dependencies
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── pages/            # Dashboard, Incidents, ManageUsers, ActivityLog, Login
│       ├── components/       # Sidebar, Toast, Pagination, IncidentDetail
│       ├── hooks/            # useToast
│       ├── lib/              # cn (clsx+tw-merge), roles (isAdmin/isSuperadmin), time (timeAgo)
│       └── services/         # Axios instance with JWT interceptor
└── infra/                    # Deployment configs
    ├── nginx/                # Reverse proxy config
    └── systemd/              # Service unit file
```

---

## Default Accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Superadmin (protected) |
| `operator_a` | `operator` | Operator |
| `operator_b` | `operator` | Operator |
| `operator_c` | `operator` | Operator |

> Change default passwords immediately after first login.

---

## Database

- **Name:** `greenfields_audit`
- **Host:** localhost:5432
- **Creds:** postgres / postgres
- **Migrations:** Run SQL files in `backend/app/migration/` in order

### Performance Indexes (Migration 002–004)

| Index | Purpose |
|---|---|
| `idx_incidents_list_active` | Composite for active incident list queries |
| `idx_incidents_sla_check` | Per-severity SLA breach detection |
| `idx_incidents_search` | GIN trigram for ILIKE on title + description |
| `idx_comments_incident_created` | Comments sorted by creation time |
| `idx_audit_entity` | Audit trail by entity type + id |
| `idx_audit_user` | Audit trail by user |
| `idx_audit_created` | Audit log pagination by created_at |
| `idx_incidents_reporter` | FK lookups on reported_by |
