-- Migration 000: Initial database schema
-- Purpose: Create all base tables, lookup data, and default indexes.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Must run BEFORE migrations 001-004.

BEGIN;

-- ============================================================================
-- 1. LOOKUP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS severity_levels (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    color VARCHAR(7) NOT NULL,
    level INTEGER NOT NULL,
    sla_hours INTEGER NOT NULL
);

INSERT INTO severity_levels (id, name, color, level, sla_hours)
VALUES
    (1, 'LOW',      '#22c55e', 1, 72),
    (2, 'MEDIUM',   '#eab308', 2, 48),
    (3, 'HIGH',     '#f97316', 3, 24),
    (4, 'CRITICAL', '#ef4444', 4, 4)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS incident_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL
);

INSERT INTO incident_statuses (id, name)
VALUES
    (1, 'OPEN'),
    (2, 'IN_PROGRESS'),
    (3, 'RESOLVED'),
    (4, 'CLOSED'),
    (5, 'ESCALATED')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'admin', 'operator')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. INCIDENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS incidents (
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

-- ============================================================================
-- 4. INCIDENT COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS incident_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 5. AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
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

-- ============================================================================
-- 6. BASE INDEXES (additional performance indexes in migration 002)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity_id);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_deleted ON incidents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

COMMIT;
