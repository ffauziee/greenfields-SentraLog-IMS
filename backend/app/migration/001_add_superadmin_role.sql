-- Migration: add superadmin role
-- Purpose: introduce a protected superadmin role while keeping existing admin/operator roles.
-- Safe to run on PostgreSQL databases created from the original assignment schema.

BEGIN;

-- Drop existing CHECK constraints on users.role, including the default
-- PostgreSQL name users_role_check or any custom name from prior setup.
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- Promote the default bootstrap admin account to superadmin.
UPDATE users
SET role = 'superadmin', updated_at = NOW()
WHERE username = 'admin' AND role = 'admin';

-- Recreate role constraint with the new role set.
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('superadmin', 'admin', 'operator'));

COMMIT;
