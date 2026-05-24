-- 005_clean_seed_data.sql
-- Clean up sample/seed data for production readiness.
-- Run this BEFORE going live to remove dummy incidents, comments, and audit logs.
-- Does NOT delete default user accounts.
--
-- GUARD: Script hanya jalan jika session variable diset.
-- Cara pakai (PowerShell):
--   $env:PGPASSWORD='postgres'
--   psql -U postgres -d greenfields_audit -c "SET myapp.allow_cleanup = true" -f 005_clean_seed_data.sql
--
-- Tanpa SET di atas, script akan throw error dan TIDAK menjalankan apa pun.
-- Ini mencegah eksekusi tidak sengaja di production.

DO $$
BEGIN
  IF current_setting('myapp.allow_cleanup', true) != 'true' THEN
    RAISE EXCEPTION 'Guard aktif: jalankan dengan SET myapp.allow_cleanup = true';
  END IF;
END $$;

BEGIN;

DELETE FROM audit_logs
WHERE entity_type IN ('incident', 'comment');

DELETE FROM incident_comments;

DELETE FROM incidents;

COMMIT;
