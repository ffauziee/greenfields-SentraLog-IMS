# Greenfields IMS

**Incident Management System** — Track, prioritise, and audit operational incidents in industrial environments.

---

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

Open `http://localhost:5173` — login with `admin` / `admin123`.

---

## Features

- **Incident CRUD** — Create, update, soft-delete with status workflow (OPEN → IN_PROGRESS → RESOLVED → CLOSED)
- **Severity Levels** — LOW / MEDIUM / HIGH / CRITICAL with per-level SLA thresholds
- **Attention Score** — 0–100 priority algorithm (severity + SLA breach + age + status)
- **Role-Based Access** — Admin (full) / Operator (assigned incidents only)
- **Audit Logging** — Immutable trail with JSONB snapshots for every mutation
- **CSV Export** — Filtered incident downloads
- **User Management** — Admin-only CRUD with smart deactivation
- **JWT Auth** — bcrypt hashing + HS256 tokens with rate-limited login

---

## Tech Stack

| Layer        | Technology                                           |
| ------------ | ---------------------------------------------------- |
| **Backend**  | FastAPI 0.104, Python 3.12+, Uvicorn 0.24            |
| **Database** | PostgreSQL 14+ (raw SQL via psycopg2)                |
| **Frontend** | React 19, Vite 8, TailwindCSS 3.4, React Router 7    |
| **Proxy**    | Nginx (reverse proxy + static files + rate limiting) |
| **Process**  | systemd (hardened unit with auto-restart)            |
| **Infra**    | Ubuntu 22.04 LTS, 1 CPU / 2 GB RAM                   |

---

## Project Structure

```
greenfields/
├── backend/          # FastAPI application
│   └── app/
│       ├── api/      # Route handlers
│       ├── core/     # Configuration
│       ├── db/       # Connection pool
│       ├── schemas/  # Pydantic models
│       ├── services/ # Business logic
│       └── utils/    # Auth utilities
├── frontend/         # React + Vite SPA
│   └── src/
│       ├── pages/    # Page components
│       ├── components/  # Shared components
│       └── services/ # Axios API client
├── infra/            # Deployment configs
│   ├── nginx/        # Reverse proxy config
│   └── systemd/      # Service unit file
└── docs/             # Documentation
```

---

## Documentation

| Document                                                     | Audience                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| [Technical Documentation](TECHNICAL_DOCUMENTATION.md)        | Architects, DevOps — system design, diagrams, deployment |
| [User Guide](docs/USER_GUIDE.md)                             | Operators, Admins — how to use the application           |
| [Developer Onboarding](docs/DEVELOPER_ONBOARDING.md)         | Developers — local setup, architecture patterns          |
| [API Reference](docs/API_REFERENCE.md)                       | Developers — complete endpoint documentation             |
| [Troubleshooting Guide](docs/TROUBLESHOOTING.md)             | SysAdmins — issue resolution                             |
| [SOP — Incident Management](docs/SOP_INCIDENT_MANAGEMENT.md) | Operations team — standard procedures                    |
| [Release Notes v1.0.0](docs/RELEASE_NOTES_v1.0.0.md)         | All — what's in this release                             |

---

## Default Accounts

| Username     | Password   | Role     |
| ------------ | ---------- | -------- |
| `admin`      | `admin123` | Admin    |
| `operator_a` | `operator` | Operator |
| `operator_b` | `operator` | Operator |
| `operator_c` | `operator` | Operator |

> Change default passwords immediately after first login.
