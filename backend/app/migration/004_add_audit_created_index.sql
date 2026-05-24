-- Migration 004: Index for audit_logs ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
