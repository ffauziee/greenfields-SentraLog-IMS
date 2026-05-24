-- Migration 002: Performance indexes for large-scale data

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_incident ON incident_comments(incident_id);
CREATE INDEX IF NOT EXISTS idx_comments_incident_created ON incident_comments(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON incident_comments(user_id);

-- Incidents FK indexes for delete_user checks
CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reported_by);

-- Composite index for common list query pattern: is_deleted=FALSE + status_id IN (...) + ORDER BY level DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_incidents_list_active ON incidents(is_deleted, status_id, created_at DESC);

-- Composite index for SLA breach query (severity_id + created_at for per-severity threshold)
CREATE INDEX IF NOT EXISTS idx_incidents_sla_check ON incidents(is_deleted, status_id, severity_id, created_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);

-- Trigram index for ILIKE search on incidents
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_incidents_search ON incidents USING gin (title gin_trgm_ops, description gin_trgm_ops);
