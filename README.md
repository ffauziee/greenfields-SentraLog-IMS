# Greenfields IMS

**Incident Management System** — Track, prioritise, and audit operational incidents in industrial environments.

---

## System Requirements

| Requirement | Minimum |
|---|---|
| **Python** | 3.12 or later |
| **Node.js** | 20 LTS or later |
| **PostgreSQL** | 14 or later |
| **npm** | Comes with Node.js |

---

## Quick Start (for Testers)

### 0. Clone & Enter

```bash
git clone <repo-url> greenfields
cd greenfields
```

### 1. Database Setup

Create database and run migrations:

**Windows (PowerShell):**
```powershell
$env:PGPASSWORD='postgres'
psql -U postgres -c "CREATE DATABASE greenfields_audit;"
Get-ChildItem backend/app/migration/*.sql | Sort-Object Name | ForEach-Object {
    psql -U postgres -d greenfields_audit -f $_.FullName
}
```

**Linux / macOS:**
```bash
sudo -u postgres psql -c "CREATE DATABASE greenfields_audit;"
for f in backend/app/migration/*.sql; do
    psql -U postgres -d greenfields_audit -f "$f"
done
```

### 2. Backend (port 8000)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> `.env` sudah tersedia — tidak perlu konfigurasi tambahan.

### 3. Frontend (port 5173)

Buka **terminal baru**:

```bash
cd frontend
npm install
npm run dev
```

### 4. Open

Buka **http://localhost:5173** dan login dengan akun default di bawah.

---

## Default Accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Superadmin |
| `operator_a` | `operator` | Operator |
| `operator_b` | `operator` | Operator |
| `operator_c` | `operator` | Operator |

> **Security note for testing:** The `.env` file is included in the repository with a placeholder `SECRET_KEY`. For production deployments, replace it with a strong random string.

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

## Project Structure

```
greenfields/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── core/             # Pydantic config, constants
│   │   ├── db/               # Connection pool, query helpers
│   │   ├── migration/        # SQL migrations (001–004)
│   │   ├── repositories/     # Raw SQL data access
│   │   ├── schemas/          # Pydantic models
│   │   ├── services/         # Business logic
│   │   └── utils/            # JWT, bcrypt, RBAC
│   └── .env                  # Environment config (pre-filled for testing)
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── pages/            # Dashboard, Incidents, ManageUsers, etc.
│       ├── components/       # Sidebar, Toast, Pagination, IncidentDetail
│       ├── hooks/            # useToast
│       ├── lib/              # Utilities (cn, roles, time)
│       └── services/         # Axios + JWT interceptor
├── docs/                     # Documentation
├── scripts/                  # Development utilities
├── deliverables/             # Project deliverables
└── infra/                    # Nginx & systemd configs
```

---

## API Endpoints Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login |
| POST | `/api/auth/seed` | None | Seed default accounts |
| GET | `/api/incidents/dashboard` | JWT | Dashboard stats |
| GET | `/api/incidents` | JWT | List incidents |
| GET | `/api/incidents/export` | JWT | Export CSV |
| POST | `/api/incidents` | JWT | Create incident |
| PUT | `/api/incidents/{id}` | JWT | Update incident |
| DELETE | `/api/incidents/{id}` | JWT | Delete incident |
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/{id}` | Admin | Update user |
| DELETE | `/api/users/{id}` | Admin | Delete user |
| GET | `/api/audit-logs` | Admin | View audit logs |

---

## Troubleshooting

**"Database connection refused"**
Ensure PostgreSQL is running on localhost:5432 and the `greenfields_audit` database exists.

**"Module not found"**
Run `pip install -r requirements.txt` and `npm install` again.

**"CORS error in browser"**
Make sure backend is running on port 8000. Vite proxies `/api` requests automatically.

**Port already in use**
Change the port:
- Backend: `uvicorn app.main:app --host 0.0.0.0 --port 8001`
- Frontend: edit `frontend/vite.config.js` server port

---

## Default Database Credentials

| Key | Value |
|---|---|
| **Host** | localhost:5432 |
| **Database** | greenfields_audit |
| **User** | postgres |
| **Password** | postgres |

Define via `DATABASE_URL` in `backend/.env` if your setup differs.
