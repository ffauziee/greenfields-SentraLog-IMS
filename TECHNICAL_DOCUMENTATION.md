# Greenfields IMS — Technical Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Classification:** Internal — Engineering & Operations

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture Design](#2-system-architecture-design)
3. [Architecture Diagrams](#3-architecture-diagrams)
4. [Deployment Guide](#4-deployment-guide)
5. [Operations Guide](#5-operations-guide)
6. [Security & Compliance](#6-security--compliance)
7. [Performance & Scaling](#7-performance--scaling)
8. [Appendix](#8-appendix)

---

## 1. System Overview

### 1.1 System Purpose

Greenfields IMS (Incident Management System) is a full-stack web application for tracking, managing, and auditing operational incidents in industrial environments. It provides role-based incident lifecycle management with automated severity prioritisation, SLA breach detection, and immutable audit logging.

### 1.2 Core Objectives

| Objective | Description |
|---|---|
| **Incident Lifecycle Management** | End-to-end tracking from creation through resolution and archival |
| **Role-Based Access Control** | Admin (full visibility) and Operator (scoped to assigned incidents) |
| **Severity Prioritisation** | Attention Score algorithm (0–100) to surface most critical items first |
| **Audit Compliance** | Immutable logs of every CREATE/UPDATE/DELETE action |
| **SLA Enforcement** | Automated breach detection per severity level with escalation triggers |

### 1.3 Operational Problems Solved

| Problem | Solution |
|---|---|
| Operators lack visibility into priority | Attention Score ranks incidents by severity, age, and SLA breach |
| No accountability trail | Every mutation is logged with old/new state snapshots |
| Ad-hoc incident reporting | Structured form with severity, location, and assignment fields |
| Delayed response to critical issues | Dashboard surfaces CRITICAL/HIGH incidents past SLA |
| Hard audit for compliance | Admin-only audit log viewer with filterable, paginated history |
| Fragmented user management | Centralised user CRUD with active/inactive state and role assignment |

### 1.4 Key Features

- **Dashboard** — Aggregate stats (total open, critical, unassigned, past-SLA) with attention-prioritised list and recent activity feed
- **Incident CRUD** — Create, update, soft-delete with status transition validation
- **Severity Levels** — LOW (1), MEDIUM (2), HIGH (3), CRITICAL (4) each with unique SLA thresholds and colours
- **Status Workflow** — OPEN → IN_PROGRESS → RESOLVED → CLOSED, plus ESCALATED for SLA breaches
- **Role-Based Scoping** — Admins see all incidents; Operators see only their assigned items
- **CSV Export** — Filtered incident data downloadable as comma-separated values
- **Audit Logging** — Full history with old/new JSONB snapshots, user attribution, and timestamps
- **User Management** — Admin-only CRUD with soft-deactivation for users with active assignments
- **JWT Authentication** — 8-hour bearer tokens with bcrypt password hashing
- **SLA & Escalation** — Automatic breach detection and escalation recommendation at 50% of SLA threshold

### 1.5 Business Impact

| Metric | Impact |
|---|---|
| Mean Time to Acknowledge (MTTA) | Reduced by attention-prioritised queue |
| Audit Readiness | Full traceability for compliance audits |
| Operator Accountability | Incidents scoped per operator tank assignment |
| Data Integrity | Soft-delete prevents accidental data loss |
| Deployment Cost | Runs on 1 CPU / 2 GB RAM VM with minimal dependencies |

---

## 2. System Architecture Design

### 2.1 Frontend Architecture

```
frontend/
├── src/
│   ├── main.jsx              # React DOM entry point
│   ├── App.jsx               # Router + auth gate + layout shell
│   ├── index.css             # Tailwind directives
│   ├── lib/
│   │   └── cn.js             # Tailwind class merge utility
│   ├── services/
│   │   └── api.js            # Axios instance with JWT interceptor
│   ├── components/
│   │   ├── Sidebar.jsx       # Collapsible navigation
│   │   └── Toast.jsx         # Auto-dismiss notification
│   └── pages/
│       ├── Login.jsx         # Auth form
│       ├── Dashboard.jsx     # Stats + attention table + recent
│       ├── Incidents.jsx     # CRUD + search + filter + export
│       ├── ManageUsers.jsx   # Admin-only user admin
│       └── ActivityLog.jsx   # Admin-only audit viewer
```

**Pattern:** Single-page application (SPA) with client-side routing via React Router DOM v7. No global state library — auth state is held in `useState` inside `App.jsx` and persisted to `localStorage`.

**State Management Approach:**

| State | Location | Persistence |
|---|---|---|
| Auth token | `App.jsx` + `localStorage` | Survives browser close |
| User profile | `App.jsx` + `localStorage` | Survives browser close |
| Sidebar open/closed | `App.jsx` `useState` | Session-only |
| Page data | Per-component `useState` | Fetched on mount |

**Routing Table:**

| Path | Component | Guard |
|---|---|---|
| `/` | Dashboard | Authenticated |
| `/incidents` | Incidents | Authenticated |
| `/manage-users` | ManageUsers | Admin only |
| `/activity-log` | ActivityLog | Admin only |
| `*` | Redirect `/` | — |

**API Layer:** A single Axios instance (`api.js`) attaches the JWT `Authorization` header via a request interceptor. A response interceptor catches 401s, clears `localStorage`, and forces a page reload to return to the login screen.

### 2.2 Backend Architecture

```
backend/
├── app/
│   ├── main.py               # FastAPI app factory, CORS, router registration
│   ├── api/
│   │   ├── auth.py           # POST /login, POST /seed
│   │   ├── incidents.py      # Full incident CRUD + dashboard + CSV export
│   │   ├── users.py          # Admin-only user CRUD + password reset
│   │   └── audit_logs.py     # Admin-only audit log viewer
│   ├── core/
│   │   └── config.py         # Pydantic Settings, env loading, constants
│   ├── db/
│   │   └── database.py       # Connection pool, query helpers
│   ├── schemas/
│   │   └── incident.py       # Pydantic request/response models
│   ├── services/
│   │   ├── attention.py      # Attention Score algorithm
│   │   └── audit.py          # Audit log insertion helper
│   └── utils/
│       └── auth.py           # JWT creation/verification, password hashing, RBAC deps
```

**Layer Responsibilities:**

| Layer | Directory | Responsibility |
|---|---|---|
| **Router** | `api/` | HTTP endpoint handlers, parameter validation, response formatting |
| **Core** | `core/` | Configuration, environment variables, application constants |
| **Database** | `db/` | Threaded connection pool, `query_all`/`query_one`/`execute` abstractions |
| **Schema** | `schemas/` | Pydantic models for request validation and response serialisation |
| **Service** | `services/` | Business logic (attention scoring, audit logging) |
| **Utility** | `utils/` | Cross-cutting concerns (auth, hashing) |

**Design Decisions:**

1. **No ORM** — Raw SQL with `psycopg2` `RealDictCursor` keeps queries explicit and avoids ORM overhead. The schema is small enough that an ORM adds complexity without benefit.

2. **Connection Pooling** — `ThreadedConnectionPool` (min 2, max 10) with context manager ensures connections are returned to the pool after every request.

3. **No Background Task Queue** — SLA checking and escalation are computed on read (dashboard query), not asynchronously. This keeps the architecture simple for a 1-CPU deployment.

4. **Dependency Injection** — FastAPI `Depends` chains: `get_current_user` → `require_role`. Every protected endpoint declares its auth dependency, making permissions auditable at a glance.

### 2.3 Database Architecture

#### Entity-Relationship Model

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│    users     │     │    incidents     │     │ severity_levels   │
├──────────────┤     ├──────────────────┤     ├───────────────────┤
│ id (PK)      │←────│ assigned_to (FK) │     │ id (PK)           │
│ username     │     │ reported_by (FK) │←────│ name              │
│ email        │     │ severity_id (FK) │──→  │ color (hex)       │
│ password_hash│     │ status_id (FK)   │──→  │ level (numeric)   │
│ full_name    │     │ title            │     │ sla_hours         │
│ role         │     │ description      │     └───────────────────┘
│ is_active    │     │ location         │
│ created_at   │     │ is_resolved      │     ┌───────────────────┐
│ updated_at   │     │ is_deleted       │     │ incident_statuses │
└──────────────┘     │ resolved_at      │     ├───────────────────┤
                     │ created_at       │     │ id (PK)           │
                     │ updated_at       │     │ name              │
                     └──────┬───────────┘     └───────────────────┘
                            │
                            │ 1:N             ┌──────────────────────┐
                            ├────────────────→│  incident_comments   │
                            │                 ├──────────────────────┤
                            │                 │ id (PK)              │
                            │                 │ incident_id (FK)     │
                            │                 │ user_id (FK)         │
                            │                 │ content (TEXT)       │
                            │                 │ created_at           │
                            │                 └──────────────────────┘
                            │ 1:N             ┌──────────────────────┐
                            └────────────────→│     audit_logs       │
                                              ├──────────────────────┤
                                              │ id (PK)              │
                                              │ user_id (FK)         │
                                              │ action (VARCHAR)     │
                                              │ entity_type (VARCHAR)│
                                              │ entity_id (VARCHAR)  │
                                              │ old_value (JSONB)    │
                                              │ new_value (JSONB)    │
                                              │ description (TEXT)   │
                                              │ ip_address (VARCHAR) │
                                              │ created_at           │
                                              └──────────────────────┘
```

#### Reference Data

**severity_levels:**

| id | name | colour | level | sla_hours |
|---|---|---|---|---|
| 1 | LOW | `#22c55e` | 1 | *configurable* |
| 2 | MEDIUM | `#eab308` | 2 | *configurable* |
| 3 | HIGH | `#f97316` | 3 | 24 |
| 4 | CRITICAL | `#ef4444` | 4 | 4 |

**incident_statuses:**

| id | name |
|---|---|
| 1 | OPEN |
| 2 | IN_PROGRESS |
| 3 | RESOLVED |
| 4 | CLOSED |
| 5 | ESCALATED |

**Status Transition Rules:**

```
Operator:   OPEN (1) → IN_PROGRESS (2) → RESOLVED (3)
            (no backward or skip transitions allowed)

Admin:      Any status → Any status (unrestricted)
```

### 2.4 API Communication Flow

```
Browser                        Nginx                         Uvicorn                      PostgreSQL
  │                              │                              │                              │
  │  ── HTTPS GET /incidents ──→ │                              │                              │
  │                              │  ── HTTP proxy /api/ ──────→ │                              │
  │                              │                              │                              │
  │                              │                              │  ── SQL query ─────────────→ │
  │                              │                              │  ←── result set ─────────────│
  │                              │                              │                              │
  │  ←── JSON response ─────────│                              │                              │
  │                              │                              │                              │
```

#### Request Lifecycle (Detailed)

1. **User Action** — React component triggers an API call via the Axios instance (e.g., `incidentsAPI.list({severity: 3})`)
2. **Interceptor** — Request interceptor reads `localStorage.getItem('token')` and attaches `Authorization: Bearer <token>` header
3. **Nginx Reverse Proxy** — Request arrives on port 80; `location /api/` matches and proxies to `http://greenfields_backend` (127.0.0.1:8000)
4. **FastAPI Router** — Uvicorn receives the request; FastAPI matches the route (`GET /api/incidents`) and extracts query parameters via Pydantic models
5. **Auth Dependency** — `get_current_user` extracts the Bearer token, decodes the JWT, looks up the user in PostgreSQL, and attaches the user dict to `request.state`
6. **Role Dependency** — If the route uses `require_role(["admin"])`, the handler checks `current_user["role"]` and returns 403 if unauthorised
7. **Business Logic** — The handler builds SQL conditions with parameterised queries, calls `query_all`/`query_one`, and processes results (e.g., computing attention scores)
8. **Response** — FastAPI serialises the Python dict to JSON via Pydantic `response_model` and returns it with appropriate HTTP status code
9. **Response Interceptor** — Axios response interceptor receives the JSON; if status is 401, it clears `localStorage` and reloads the page
10. **Component Re-render** — React state updates trigger a re-render of the relevant UI

### 2.5 Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐
│  Login    │     │  Backend  │     │  Auth    │     │ PostgreSQL │
│  Page     │     │  (Nginx)  │     │  Utils   │     │            │
└─────┬─────┘     └─────┬─────┘     └─────┬─────┘     └─────┬──────┘
      │                 │                 │                 │
      │ POST /api/auth/login               │                 │
      │ {username, password}               │                 │
      │────────────────→│                 │                 │
      │                 │                 │                 │
      │                 │ SELECT * FROM users               │
      │                 │ WHERE username=%s                 │
      │                 │──────────────────────────────────→│
      │                 │                 │                 │
      │                 │   ← user row ─────────────────────│
      │                 │                 │                 │
      │                 │ verify_password(plain, hash)      │
      │                 │────────────────→│                 │
      │                 │ ← ok ───────────│                 │
      │                 │                 │                 │
      │                 │ create_access_token({sub, role})  │
      │                 │────────────────→│                 │
      │                 │ ← JWT ──────────│                 │
      │                 │                 │                 │
      │  ← {access_token, role,           │                 │
      │      full_name, user_id}          │                 │
      │←────────────────│                 │                 │
      │                 │                 │                 │
      │ Store in localStorage             │                 │
      │ Set axios default header          │                 │
      │ Navigate to Dashboard             │                 │
```

#### Token Structure

```json
{
  "sub": "uuid-of-user",
  "role": "admin",
  "exp": 1700000000
}
```

- **Algorithm:** HS256
- **Secret:** Configured via `SECRET_KEY` env variable
- **Expiry:** 480 minutes (8 hours), configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
- **Hash:** bcrypt with auto-generated salt

#### Protected Request Flow

1. Axios request interceptor attaches `Authorization: Bearer <token>`
2. FastAPI `HTTPBearer` security scheme extracts the token
3. `get_current_user` dependency decodes via `jose.jwt.decode`, validates `exp`
4. User is looked up in PostgreSQL; inactive users are rejected
5. `require_role` checks `current_user["role"]` against the allowed list
6. If any step fails, the response interceptor on the client catches the 401/403

### 2.6 Severity Prioritisation Engine

The Attention Score algorithm (`backend/app/services/attention.py`) computes a 0–100 priority score for each active incident. This score drives the dashboard's attention-prioritised list.

#### Algorithm Breakdown

```python
def calculate_attention_score(incident: dict, age_hours: float) -> int:
```

| Component | Max Points | Logic |
|---|---|---|
| **Severity Weight** | 40 | LOW=10, MEDIUM=20, HIGH=30, CRITICAL=40 |
| **SLA Breach** | 30 | `min((age - sla) / sla, 1.0) * 30` — linear ramp from breach to 100% over-SLA |
| **Recency** | 20 | ≤1h = 20, ≤4h = 15, ≤12h = 10, ≤24h = 5, >24h = 0 |
| **Status** | 10 | OPEN = 10, ESCALATED = 8, IN_PROGRESS = 5, others = 0 |
| **Total** | **100** | Capped at `min(score, 100)` |

#### Dashboard Query Ordering

The dashboard SQL orders incidents before scoring applies to presentation:

```sql
ORDER BY
  CASE WHEN st.name IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,  -- unacknowledged first
  s.level DESC,                                                    -- highest severity first
  CASE WHEN i.created_at < NOW() - (s.sla_hours || ' hours')::INTERVAL THEN 0 ELSE 1 END, -- breached SLA first
  i.created_at ASC                                                -- oldest first
```

#### Escalation Trigger

```python
def check_escalation(incident: dict, age_hours: float) -> bool:
    # Returns True when severity ≥ HIGH and age ≥ 50% of SLA threshold
```

This function is called at query time; incidents meeting the criteria are flagged for escalation. The dashboard can then surface these for admin action. There is no automatic status change — escalation requires a human to transition the status to ESCALATED.

### 2.7 Audit Logging Flow

```
User Action        API Handler                    Service Layer            PostgreSQL
    │                  │                              │                       │
    │ Update Incident  │                              │                       │
    │─────────────────→│                              │                       │
    │                  │                              │                       │
    │                  │ 1. Read existing row         │                       │
    │                  │    (full snapshot)           │──SELECT──────────────→│
    │                  │←─────────────────────────────│←────existing row ─────│
    │                  │                              │                       │
    │                  │ 2. Execute UPDATE            │                       │
    │                  │─────────────────────────────→│──UPDATE──────────────→│
    │                  │                              │                       │
    │                  │ 3. create_audit_log(         │                       │
    │                  │     user_id="...",           │                       │
    │                  │     action="UPDATE",         │                       │
    │                  │     entity_type="incident",  │                       │
    │                  │     entity_id="...",         │                       │
    │                  │     old_value={...full...},  │                       │
    │                  │     new_value={...changed...},│                      │
    │                  │     description=None,        │                       │
    │                  │     ip_address=None)         │                       │
    │                  │─────────────────────────────→│──INSERT INTO ────────→│
    │                  │                              │   audit_logs          │
    │                  │                              │                       │
    │  ← 200 OK ──────│                              │                       │
```

#### Audit Log Schema

| Column | Type | Description |
|---|---|---|
| `id` | UUID/SERIAL | Primary key |
| `user_id` | UUID (FK → users) | Who performed the action |
| `action` | VARCHAR | One of: `CREATE`, `UPDATE`, `DELETE` |
| `entity_type` | VARCHAR | Currently always `"incident"` |
| `entity_id` | VARCHAR | The incident ID |
| `old_value` | JSONB | Full row snapshot before the mutation (`NULL` for CREATE) |
| `new_value` | JSONB | Changed fields after the mutation (`NULL` for DELETE) |
| `description` | TEXT | Optional human-readable summary |
| `ip_address` | VARCHAR | Client IP (currently not populated) |
| `created_at` | TIMESTAMP | When the log entry was created |

#### Audit Data Capture Points

| Endpoint | Action | old_value | new_value |
|---|---|---|---|
| `POST /api/incidents` | CREATE | `NULL` | `{title, severity_id, assigned_to}` |
| `PUT /api/incidents/{id}` | UPDATE | Full SELECT * | Dict of changed fields |
| `DELETE /api/incidents/{id}` | DELETE | Full SELECT * | `NULL` |

---

## 3. Architecture Diagrams

### 3.1 High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        B[Browser\nReact SPA]
    end

    subgraph "Reverse Proxy Layer"
        N[Nginx\nPort 80\nReverse Proxy / Static Files]
    end

    subgraph "Application Layer"
        UV[Uvicorn\nASGI Server\nWorkers: 2]
        FA[FastAPI Application\nGreenfields IMS Backend]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL\ngreenfields_audit)]
    end

    B -- "HTTP / HTTPS" --> N
    N -- "/api/* proxy_pass" --> UV
    N -- "/* serve static" --> B
    UV -- "ASGI interface" --> FA
    FA -- "Connection Pool\n(min:2, max:10)" --> PG

    style B fill:#e1f5fe,stroke:#01579b
    style N fill:#fff3e0,stroke:#e65100
    style UV fill:#f3e5f5,stroke:#6a1b9a
    style FA fill:#f3e5f5,stroke:#6a1b9a
    style PG fill:#e8f5e9,stroke:#1b5e20
```

### 3.2 Backend Architecture — Component & Dependency Diagram

```mermaid
graph LR
    subgraph "FastAPI Application"
        direction TB
        M[main.py\nApp Factory]
        subgraph "API Routers"
            A[auth.py\n/login /seed]
            I[incidents.py\nCRUD + Dashboard + CSV]
            U[users.py\nUser CRUD]
            AL[audit_logs.py\nLog Viewer]
        end
        subgraph "Core"
            C[config.py\nSettings]
        end
        subgraph "Database"
            DB[database.py\nPool + Query Helpers]
        end
        subgraph "Services"
            S1[attention.py\nScoring Engine]
            S2[audit.py\nLog Writer]
        end
        subgraph "Utils"
            UT[auth.py\nJWT + Hashing + RBAC]
        end
        subgraph "Schemas"
            SC[incident.py\nPydantic Models]
        end
    end

    M --> A
    M --> I
    M --> U
    M --> AL
    I --> S1
    I --> S2
    I --> UT
    I --> DB
    U --> UT
    U --> DB
    AL --> DB
    A --> UT
    A --> DB
    S2 --> DB
    C --- M
    C --- DB

    style M fill:#ce93d8,stroke:#6a1b9a
    style A fill:#e1bee7,stroke:#6a1b9a
    style I fill:#e1bee7,stroke:#6a1b9a
    style U fill:#e1bee7,stroke:#6a1b9a
    style AL fill:#e1bee7,stroke:#6a1b9a
    style DB fill:#a5d6a7,stroke:#1b5e20
    style S1 fill:#ffe0b2,stroke:#e65100
    style S2 fill:#ffe0b2,stroke:#e65100
    style UT fill:#b3e5fc,stroke:#01579b
    style SC fill:#f0f4c3,stroke:#827717
    style C fill:#f8bbd0,stroke:#880e4f
```

### 3.3 Database Relationship Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        varchar username UK
        varchar email
        text password_hash
        varchar full_name
        varchar role "admin | operator"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    incidents {
        uuid id PK
        varchar title
        text description
        int severity_id FK
        int status_id FK
        varchar location
        uuid assigned_to FK "nullable"
        uuid reported_by FK
        boolean is_resolved
        boolean is_deleted "soft delete"
        timestamp resolved_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    severity_levels {
        int id PK "1=LOW,2=MEDIUM,3=HIGH,4=CRITICAL"
        varchar name
        varchar color "hex color"
        int level "numeric sort order"
        int sla_hours "SLA threshold"
    }

    incident_statuses {
        int id PK "1=OPEN,2=IN_PROGRESS,3=RESOLVED,4=CLOSED,5=ESCALATED"
        varchar name
    }

    incident_comments {
        uuid id PK
        uuid incident_id FK
        uuid user_id FK
        text content
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        varchar action "CREATE | UPDATE | DELETE"
        varchar entity_type
        varchar entity_id
        jsonb old_value "snapshot before mutation"
        jsonb new_value "snapshot after mutation"
        text description
        varchar ip_address
        timestamp created_at
    }

    users ||--o{ incidents : "reports"
    users ||--o{ incidents : "assigned"
    incidents ||--|| severity_levels : "has"
    incidents ||--|| incident_statuses : "has"
    incidents ||--o{ incident_comments : "contains"
    users ||--o{ incident_comments : "writes"
    users ||--o{ audit_logs : "performs"
```

### 3.4 API Request Flow — Full Lifecycle

```mermaid
sequenceDiagram
    participant User as Browser
    participant Axios as Axios Interceptor
    participant Nginx as Nginx Reverse Proxy
    participant FastAPI as FastAPI App
    participant Auth as Auth Dependency
    participant Handler as Route Handler
    participant DB as PostgreSQL

    User->>Axios: Trigger API call
    Axios->>Axios: Attach Authorization: Bearer <token>
    Axios->>Nginx: HTTP GET /api/incidents?severity=3
    Nginx->>FastAPI: proxy_pass to 127.0.0.1:8000
    FastAPI->>Auth: Depends(get_current_user)
    Auth->>Auth: Decode JWT (jose.jwt.decode)
    Auth->>DB: SELECT id, username, role, is_active
    DB-->>Auth: User row
    Auth-->>FastAPI: current_user dict
    FastAPI->>Auth: Depends(require_role(["admin"]))
    Auth-->>FastAPI: OK or 403
    FastAPI->>Handler: Call endpoint function
    Handler->>DB: Parameterised SQL query with RealDictCursor
    DB-->>Handler: List of incident dicts
    Handler->>Handler: Compute attention scores
    Handler-->>FastAPI: Response dict
    FastAPI-->>Nginx: JSON response
    Nginx-->>Axios: HTTP 200 JSON
    Axios-->>User: Response data
    User->>User: setState() → re-render
```

### 3.5 Authentication Flow — Detailed

```mermaid
sequenceDiagram
    participant Client as Login Page
    participant API as API Service (api.js)
    participant Nginx as Nginx
    participant Backend as FastAPI
    participant AuthUtil as Auth Utils
    participant DB as PostgreSQL

    Client->>API: POST /api/auth/login {username, password}
    API->>Nginx: HTTP POST
    Nginx->>Backend: Reverse proxy
    Backend->>DB: SELECT * FROM users WHERE username=%s
    DB-->>Backend: User row (or null)
    Note over Backend: If no user → 401
    Backend->>AuthUtil: verify_password(plain, hash)
    AuthUtil-->>Backend: True / False
    Note over Backend: If False → 401
    Backend->>AuthUtil: create_access_token({sub, role})
    AuthUtil-->>Backend: JWT string
    Backend-->>Client: {access_token, role, full_name, user_id}

    Note over Client: Store in localStorage

    Client->>Client: localStorage.setItem('token', token)
    Client->>Client: localStorage.setItem('user', JSON.stringify({role, full_name, user_id}))
    Client->>Client: window.location = '/'
```

### 3.6 Deployment Architecture

```mermaid
graph TB
    subgraph "Ubuntu 22.04 LTS VM"
        subgraph "1 CPU / 2 GB RAM"
            subgraph "systemd Services"
                PG[(PostgreSQL 14+)]
                SVC[greenfields-backend.service\nUvicorn Workers: 2]
            end

            subgraph "Nginx"
                NGINX[Nginx\nPort 80]
                STATIC["/opt/greenfields/frontend/dist\nStatic Files"]
                API_REV[API Reverse Proxy\nlocalhost:8000]
            end

            subgraph "Application Directory"
                APP_BACK["/opt/greenfields/backend/\nmain.py, .env"]
                APP_FRONT["/opt/greenfields/frontend/dist/\nvite build output"]
            end
        end
    end

    INTERNET((Internet)) --> NGINX
    NGINX --> STATIC
    NGINX --> API_REV
    API_REV --> SVC
    SVC --> PG
    SVC --> APP_BACK

    style INTERNET fill:#fce4ec,stroke:#b71c1c
    style PG fill:#e8f5e9,stroke:#1b5e20
    style NGINX fill:#fff3e0,stroke:#e65100
    style SVC fill:#f3e5f5,stroke:#6a1b9a
    style STATIC fill:#e3f2fd,stroke:#0d47a1
    style APP_BACK fill:#ede7f6,stroke:#311b92
    style APP_FRONT fill:#e3f2fd,stroke:#0d47a1
```

---

## 4. Deployment Guide

### 4.1 Infrastructure Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Network | Port 80 open | Port 80 + 443 (TLS) |

### 4.2 Prerequisites

```bash
# System packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib python3 python3-pip python3-venv curl git

# Node.js 18+ for frontend build
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
python3 --version  # 3.10+
node --version      # 18+
npm --version
```

### 4.3 Database Setup

```bash
# Start PostgreSQL
sudo systemctl enable postgresql && sudo systemctl start postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE greenfields_audit;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Create schema tables
sudo -u postgres psql -d greenfields_audit <<EOF
CREATE TABLE severity_levels (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    color VARCHAR(7) NOT NULL,
    level INTEGER NOT NULL,
    sla_hours INTEGER NOT NULL
);

INSERT INTO severity_levels (id, name, color, level, sla_hours) VALUES
    (1, 'LOW', '#22c55e', 1, 72),
    (2, 'MEDIUM', '#eab308', 2, 48),
    (3, 'HIGH', '#f97316', 3, 24),
    (4, 'CRITICAL', '#ef4444', 4, 4);

CREATE TABLE incident_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL
);

INSERT INTO incident_statuses (id, name) VALUES
    (1, 'OPEN'), (2, 'IN_PROGRESS'), (3, 'RESOLVED'),
    (4, 'CLOSED'), (5, 'ESCALATED');

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity_id INTEGER NOT NULL REFERENCES severity_levels(id),
    status_id INTEGER NOT NULL DEFAULT 1 REFERENCES incident_statuses(id),
    location VARCHAR(255),
    assigned_to UUID REFERENCES users(id),
    reported_by UUID NOT NULL REFERENCES users(id),
    is_resolved BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE incident_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    entity_type VARCHAR NOT NULL,
    entity_id VARCHAR NOT NULL,
    old_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_incidents_status ON incidents(status_id);
CREATE INDEX idx_incidents_severity ON incidents(severity_id);
CREATE INDEX idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX idx_incidents_created ON incidents(created_at);
CREATE INDEX idx_incidents_deleted ON incidents(is_deleted);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
EOF
```

### 4.4 Application Deployment

```bash
# Create application user
sudo useradd -r -s /bin/false -m -d /opt/greenfields greenfields

# Clone or copy source
sudo mkdir -p /opt/greenfields
# Copy backend/ to /opt/greenfields/backend
# Copy frontend/ to /opt/greenfields/frontend

# Backend setup
sudo -u greenfields python3 -m venv /opt/greenfields/backend/.venv
sudo -u greenfields /opt/greenfields/backend/.venv/bin/pip install -r /opt/greenfields/backend/requirements.txt

# Create .env
sudo tee /opt/greenfields/backend/.env <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/greenfields_audit
SECRET_KEY=$(openssl rand -hex 32)
ACCESS_TOKEN_EXPIRE_MINUTES=480
EOF
sudo chown greenfields:greenfields /opt/greenfields/backend/.env
sudo chmod 600 /opt/greenfields/backend/.env

# Frontend build
cd /opt/greenfields/frontend
npm ci
npm run build  # outputs to dist/

# Install systemd service
sudo cp infra/systemd/greenfields-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable greenfields-backend
sudo systemctl start greenfields-backend

# Configure Nginx
sudo cp infra/nginx/greenfields.conf /etc/nginx/sites-available/greenfields
sudo ln -sf /etc/nginx/sites-available/greenfields /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable nginx
sudo systemctl restart nginx

# Seed default users
curl -X POST http://localhost/api/auth/seed
```

### 4.5 Post-Deployment Verification

```bash
# Health check
curl http://localhost/health
# Expected: {"status":"healthy","app":"Greenfields Audit System","database":"connected"}

# Test login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: {"access_token":"...","role":"admin","full_name":"System Admin","user_id":"..."}

# Verify frontend
curl -s http://localhost/ | head -5
# Expected: HTML with <title>Greenfields IMS</title>
```

### 4.6 Default Credentials

| Username | Password | Role | Full Name |
|---|---|---|---|
| `admin` | `admin123` | admin | System Admin |
| `operator_a` | `operator` | operator | Operator Tangki A |
| `operator_b` | `operator` | operator | Operator Tangki B |
| `operator_c` | `operator` | operator | Operator Tangki C |

> **Security Note:** Change the default admin password immediately after first login. The seed endpoint (`POST /api/auth/seed`) is idempotent and safe to call multiple times.

---

## 5. Operations Guide

### 5.1 Service Management

```bash
# Backend service
sudo systemctl status greenfields-backend
sudo systemctl restart greenfields-backend
sudo systemctl stop greenfields-backend
sudo journalctl -u greenfields-backend -f  # Live logs

# Nginx
sudo nginx -t                   # Test configuration
sudo systemctl reload nginx     # Graceful reload

# PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -d greenfields_audit  # Direct SQL access
```

### 5.2 Logging

| Log Source | Location | Retention |
|---|---|---|
| Application | `journalctl -u greenfields-backend` | Configurable via journald |
| Nginx Access | `/var/log/nginx/access.log` | Logrotate managed |
| Nginx Error | `/var/log/nginx/error.log` | Logrotate managed |
| PostgreSQL | `/var/log/postgresql/postgresql-*.log` | Logrotate managed |
| Audit Logs | Database table `audit_logs` | Immutable (application-level) |

### 5.3 Monitoring

```bash
# Resource usage
htop
df -h /opt/greenfields
free -m

# Database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'greenfields_audit';"

# Pool health
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE application_name LIKE '%psycopg%';"

# Application health endpoint
curl http://localhost/health
```

### 5.4 Backup & Restore

```bash
# Backup database
pg_dump -U postgres greenfields_audit > /backups/greenfields_$(date +%Y%m%d_%H%M%S).sql

# Backup application config
tar czf /backups/greenfields-config_$(date +%Y%m%d).tar.gz /opt/greenfields/backend/.env

# Restore database
sudo -u postgres psql -d greenfields_audit < /backups/greenfields_20260521_120000.sql
```

### 5.5 Troubleshooting

| Symptom | Likely Cause | Diagnostic | Resolution |
|---|---|---|---|
| 502 Bad Gateway | Backend not running | `systemctl status greenfields-backend` | `systemctl restart greenfields-backend` |
| 401 on all requests | Token expired or invalid | Check `localStorage` token | Re-login |
| 403 Forbidden | Role mismatch | Verify `current_user["role"]` in logs | Check user role in DB |
| Database connection errors | PostgreSQL down or pool exhausted | `systemctl status postgresql`; check `pg_stat_activity` | `systemctl restart postgresql` |
| Static files 404 | Frontend not built | Check `/opt/greenfields/frontend/dist/` exists | Run `npm run build` |
| Login rate limited | 5 req/min exceeded | Check Nginx `limit_req` logs in error log | Wait or adjust `rate=` in Nginx config |
| Slow dashboard | No indexes on large tables | `EXPLAIN ANALYZE` on dashboard queries | Verify indexes from schema migration |

---

## 6. Security & Compliance

### 6.1 Authentication Security

| Control | Implementation |
|---|---|
| Password hashing | bcrypt via `passlib[bcrypt]` with auto-generated salt |
| JWT signing | HS256 with configurable `SECRET_KEY` |
| Token expiry | 480 minutes (configurable) |
| Inactive user rejection | `get_current_user` checks `is_active` flag |
| Rate limiting | Nginx `limit_req_zone` — 5 requests/minute per IP on `/api/auth/login` |

### 6.2 Data Protection

| Control | Implementation |
|---|---|
| SQL injection prevention | Parameterised queries via psycopg2 (`%s` placeholders) |
| Soft delete | `is_deleted` flag on incidents; no data loss |
| Audit immutability | Audit logs are INSERT-only; no UPDATE/DELETE endpoints exist |
| Input validation | Pydantic models with length, range, and pattern constraints |
| CORS | Whitelist origins: `localhost:5173`, `localhost:3000` |

### 6.3 Infrastructure Security

| Control | Implementation |
|---|---|
| systemd hardening | `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true` |
| File permissions | `.env` is `chmod 600` owned by `greenfields` user |
| Hidden file blocking | Nginx denies all `/.` paths |
| Reverse proxy isolation | Backend listens on `127.0.0.1:8000` only; no direct external access |
| Read-only paths | `ReadWritePaths=/opt/greenfields/backend` limits write scope |

### 6.4 Audit Trail Compliance

The `audit_logs` table provides a full non-repudiation trail:

| Requirement | Coverage |
|---|---|
| Who performed the action | `user_id` with join to `users.username` |
| What action was performed | `action` column (CREATE/UPDATE/DELETE) |
| What changed | `old_value` + `new_value` JSONB snapshots |
| When it happened | `created_at` with UTC timestamps |
| On which entity | `entity_type` + `entity_id` |

---

## 7. Performance & Scaling

### 7.1 Current Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Uvicorn workers | 2 | Matches 1 CPU core (2 workers per core) |
| Connection pool min | 2 | Keep-alive for frequent queries |
| Connection pool max | 10 | Headroom for concurrent requests |
| `--limit-concurrency` | 100 | Prevents thundering herd |
| `--backlog` | 2044 | TCP listen queue depth |
| Nginx `worker_processes` | auto (1) | Single core |
| `LimitNOFILE` | 65536 | File descriptor ceiling for connections |

### 7.2 Identified Bottlenecks

| Bottleneck | Impact | Mitigation |
|---|---|---|
| Raw SQL without query builder | Manual SQL maintenance | Acceptable for current schema size |
| Attention score computed in Python | CPU cost per dashboard load | Caching layer or move to SQL window function |
| No Redis cache | Repeated dashboard queries hit DB each time | Add Redis for dashboard aggregation caching |
| Single-server architecture | No horizontal redundancy | Add Nginx upstream servers + read replicas |

### 7.3 Scaling Strategy

**Vertical (immediate):**
- Increase VM to 2 CPU / 4 GB RAM
- Increase `--workers 4` and `maxconn=20`

**Horizontal (future):**
- Deploy additional Uvicorn instances on ports 8001, 8002
- Uncomment upstream servers in `greenfields.conf`
- Add a load balancer (HAProxy or AWS ALB) in front of Nginx
- Move PostgreSQL to a separate host
- Add Redis for session caching and dashboard aggregation

**Read Scalability:**
- Add PostgreSQL read replicas for dashboard queries
- Route read-only queries to replicas via a connection pooler (PgBouncer)

---

## 8. Appendix

### 8.1 Directory Structure Reference

```
/opt/greenfields/
├── backend/
│   ├── .env                    # Environment variables (chmod 600)
│   ├── requirements.txt        # Python dependencies
│   ├── .venv/                  # Python virtual environment
│   └── app/
│       ├── __init__.py
│       ├── main.py             # FastAPI entry point
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py         # Login + seed
│       │   ├── incidents.py    # Incident CRUD + dashboard
│       │   ├── users.py        # User management
│       │   └── audit_logs.py   # Audit log queries
│       ├── core/
│       │   ├── __init__.py
│       │   └── config.py       # Settings
│       ├── db/
│       │   ├── __init__.py
│       │   └── database.py     # Pool + queries
│       ├── schemas/
│       │   ├── __init__.py
│       │   └── incident.py     # Pydantic models
│       ├── services/
│       │   ├── __init__.py
│       │   ├── attention.py    # Scoring algorithm
│       │   └── audit.py        # Log writer
│       └── utils/
│           ├── __init__.py
│           └── auth.py         # JWT, bcrypt, RBAC
├── frontend/
│   └── dist/                   # Vite build output (served by Nginx)
└── infra/
    ├── nginx/
    │   └── greenfields.conf
    └── systemd/
        └── greenfields-backend.service
```

### 8.2 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/greenfields_audit` | PostgreSQL connection string |
| `SECRET_KEY` | Yes | `ganti-ini-dengan-random-string-panjang` | JWT signing secret (change immediately) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `480` | JWT lifetime in minutes |

### 8.3 Frontend Build Configuration

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000'  // Dev proxy only
    }
  }
})
```

In production, the Vite proxy is not used. Nginx serves the built `dist/` directory as static files and reverse-proxies `/api/` to Uvicorn.

### 8.4 systemd Service Configuration

```ini
[Unit]
Description=Greenfields Audit & Incident Logs Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=greenfields
Group=greenfields
WorkingDirectory=/opt/greenfields/backend
EnvironmentFile=/opt/greenfields/backend/.env
Environment="PYTHONPATH=/opt/greenfields/backend"

ExecStart=/usr/bin/python3 -m uvicorn app.main:app \
    --host 127.0.0.1 --port 8000 \
    --workers 2 \
    --timeout-graceful-shutdown 30 \
    --limit-concurrency 100 \
    --backlog 2048

ExecReload=/bin/kill -s HUP $MAINPID
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/greenfields/backend

LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### 8.5 Nginx Configuration

```nginx
upstream greenfields_backend {
    least_conn;
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name greenfields.local;
    client_max_body_size 10M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;
    gzip_proxied any;

    root /opt/greenfields/frontend/dist;
    index index.html;

    # API reverse proxy
    location /api/ {
        proxy_pass http://greenfields_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        limit_req zone=login burst=5 nodelay;
    }

    # Health check
    location /health {
        proxy_pass http://greenfields_backend;
        access_log off;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
```

### 8.6 API Endpoint Summary

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/health` | None | — | Health check |
| POST | `/api/auth/login` | None | — | User login |
| POST | `/api/auth/seed` | None | — | Seed default users |
| GET | `/api/incidents/dashboard` | JWT | All | Dashboard aggregates |
| GET | `/api/incidents` | JWT | All | List incidents (filtered + paginated) |
| GET | `/api/incidents/export` | JWT | All | Export as CSV |
| GET | `/api/incidents/{id}` | JWT | All | Get single incident |
| POST | `/api/incidents` | JWT | All | Create incident |
| PUT | `/api/incidents/{id}` | JWT | All | Update incident |
| DELETE | `/api/incidents/{id}` | JWT | All | Soft-delete incident |
| GET | `/api/users` | JWT | Admin | List users |
| POST | `/api/users` | JWT | Admin | Create user |
| PUT | `/api/users/{id}` | JWT | Admin | Update user |
| PUT | `/api/users/{id}/reset-password` | JWT | Admin | Reset password |
| DELETE | `/api/users/{id}` | JWT | Admin | Delete/deactivate user |
| GET | `/api/audit-logs` | JWT | Admin | List audit logs |
| GET | `/api/audit-logs/users` | JWT | Admin | Distinct audit users |

### 8.7 Glossary

| Term | Definition |
|---|---|
| **Attention Score** | A 0–100 computed priority score based on severity, SLA breach, age, and status |
| **SLA** | Service Level Agreement — time threshold within which an incident should be addressed |
| **RBAC** | Role-Based Access Control — two roles: `admin` (full access) and `operator` (scoped) |
| **Soft Delete** | Marking a record as deleted (`is_deleted = TRUE`) without physically removing it |
| **JWT** | JSON Web Token — stateless authentication token signed with HS256 |
| **JSONB** | PostgreSQL binary JSON column type used for audit log snapshots |
| **Connection Pool** | A cache of database connections maintained to avoid connection overhead per request |
| **systemd** | Linux init system used for process supervision and lifecycle management |

---

*End of Technical Documentation — Greenfields IMS v1.0.0*
