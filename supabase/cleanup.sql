-- =============================================================================
-- COMPREHENSIVE CLEANUP SCRIPT
-- =============================================================================
-- This script removes ALL existing database objects to prepare for fresh
-- declarative schema migration. Run this BEFORE applying new schema files.

-- WARNING: This script will DROP ALL existing tables, functions, types, etc.
-- Make sure to backup your database before running this script!

-- =============================================================================
-- Drop Custom Schemas (PRESERVE clerk and clerk_dev schemas)
-- =============================================================================

-- Drop custom schemas but preserve clerk and clerk_dev schemas completely
DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS connect CASCADE;
DROP SCHEMA IF EXISTS system CASCADE;
DROP SCHEMA IF EXISTS chat CASCADE;
-- IMPORTANT: clerk and clerk_dev schemas are COMPLETELY PRESERVED - no tables, functions, or data will be touched

-- =============================================================================
-- Drop All Public Schema Tables
-- =============================================================================

-- Dynamically drop ALL tables in public schema (except system tables and clerk tables)
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('spatial_ref_sys') -- Preserve PostGIS system table
        AND tablename NOT IN ('users', 'organizations', 'email_addresses', 'phone_numbers', 'raw_objects') -- Preserve clerk tables in public schema
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(table_record.schemaname) || '.' || quote_ident(table_record.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Also drop any tables that might exist in other schemas we're about to recreate
-- (Preserving clerk and clerk_dev schemas completely)
DROP TABLE IF EXISTS core.organizations CASCADE;
DROP TABLE IF EXISTS core.provisioning_workflows CASCADE;
DROP TABLE IF EXISTS core.organization_quotas CASCADE;
DROP TABLE IF EXISTS connect.data_destinations CASCADE;
DROP TABLE IF EXISTS connect.data_connections CASCADE;
DROP TABLE IF EXISTS connect.connector_types CASCADE;
DROP TABLE IF EXISTS system.audit_events CASCADE;
DROP TABLE IF EXISTS system.secrets CASCADE;
DROP TABLE IF EXISTS system.idempotency_keys CASCADE;
DROP TABLE IF EXISTS system.rate_limits CASCADE;
-- Note: clerk and clerk_dev schemas and their tables are completely preserved

-- =============================================================================
-- Drop All Public Schema Views
-- =============================================================================

-- Dynamically drop ALL views in public schema
DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN
        SELECT schemaname, viewname
        FROM pg_views
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(view_record.schemaname) || '.' || quote_ident(view_record.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Drop All Public Schema Functions
-- =============================================================================

-- Dynamically drop ALL functions in public schema (except system functions)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%' -- Exclude system functions
        AND p.proname NOT LIKE 'st_%' -- Exclude PostGIS functions
        AND p.proname NOT LIKE 'spatial_%' -- Exclude PostGIS functions
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(func_record.schema_name) || '.' || quote_ident(func_record.function_name) || '(' || func_record.args || ') CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Drop All Public Schema Types
-- =============================================================================

-- Dynamically drop ALL custom types in public schema
DO $$
DECLARE
    type_record RECORD;
BEGIN
    FOR type_record IN
        SELECT n.nspname as schema_name, t.typname as type_name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        AND t.typtype = 'e' -- Only enum types
        AND t.typname NOT LIKE 'pg_%' -- Exclude system types
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(type_record.schema_name) || '.' || quote_ident(type_record.type_name) || ' CASCADE';
    END LOOP;
END $$;

-- Drop types from custom schemas
DROP TYPE IF EXISTS core.organization_status_t CASCADE;
DROP TYPE IF EXISTS core.provisioning_status_t CASCADE;
DROP TYPE IF EXISTS connect.destination_status_t CASCADE;
DROP TYPE IF EXISTS connect.connection_status_t CASCADE;

-- =============================================================================
-- Drop All Public Schema Sequences
-- =============================================================================

-- Dynamically drop ALL sequences in public schema
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN
        SELECT schemaname, sequencename
        FROM pg_sequences
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(seq_record.schemaname) || '.' || quote_ident(seq_record.sequencename) || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Clean Up Orphaned Objects
-- =============================================================================

-- Drop any remaining sequences that might be orphaned
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN
        SELECT ps.schemaname, ps.sequencename
        FROM pg_sequences ps
        WHERE ps.schemaname = 'public'
        AND ps.sequencename LIKE '%_id_seq'
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = ps.schemaname
            AND c.relname = replace(ps.sequencename, '_id_seq', '')
        )
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(seq_record.schemaname) || '.' || quote_ident(seq_record.sequencename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop any remaining indexes that might be orphaned
DO $$
DECLARE
    idx_record RECORD;
BEGIN
    FOR idx_record IN
        SELECT pi.schemaname, pi.indexname
        FROM pg_indexes pi
        WHERE pi.schemaname = 'public'
        AND pi.indexname LIKE 'idx_%'
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = pi.schemaname
            AND c.relname = pi.indexname
        )
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idx_record.schemaname) || '.' || quote_ident(idx_record.indexname) || ' CASCADE';
    END LOOP;
END $$;

-- Drop any remaining constraints that might be orphaned
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE', 'PRIMARY KEY')
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = tc.table_schema
            AND c.relname = tc.table_name
        )
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(constraint_record.table_schema) || '.' || quote_ident(constraint_record.table_name) ||
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.constraint_name) || ' CASCADE';
    END LOOP;
END $$;

-- Drop any remaining functions that might be orphaned
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname LIKE 'trg_%'
        AND NOT EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n2 ON n2.oid = c.relnamespace
            WHERE n2.nspname = n.nspname
            AND t.tgname = p.proname
        )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(func_record.schema_name) || '.' || quote_ident(func_record.function_name) || '(' || func_record.args || ') CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Clean Up Orphaned Schemas
-- =============================================================================

-- Drop any empty schemas that might be left over (PRESERVE clerk and clerk_dev schemas)
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public', 'extensions', 'graphql_public', 'graphql', 'realtime', 'storage', 'vault', 'supabase_functions', 'supabase_migrations', 'auth', 'pgsodium', 'pgsodium_masks', 'net', 'pgtap', 'clerk', 'clerk_dev')
        AND nspname NOT LIKE 'pg_%'
        AND nspname NOT LIKE 'supabase_%'
        AND nspname NOT LIKE 'clerk%' -- Extra protection for clerk schemas
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            WHERE c.relnamespace = pg_namespace.oid
        )
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(schema_record.nspname) || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Reset Extensions
-- =============================================================================

-- Note: We don't drop extensions as they might be needed by Supabase
-- The new schema will ensure they are properly enabled

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Run these queries to verify cleanup was successful:

-- 1. Check for remaining tables in public schema (should be empty)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Check for remaining functions in public schema (should be empty)
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';

-- 3. Check for remaining views in public schema (should be empty)
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

-- 4. Check for remaining sequences in public schema (should be empty)
-- SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';

-- 5. Check for remaining types in public schema (should be empty)
-- SELECT type_name FROM information_schema.types WHERE type_schema = 'public';

-- 6. Check for remaining custom schemas (should only have clerk and clerk_dev schemas)
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public', 'extensions', 'graphql_public', 'graphql', 'realtime', 'storage', 'vault', 'supabase_functions', 'supabase_migrations', 'auth', 'pgsodium', 'pgsodium_masks', 'net', 'pgtap', 'clerk', 'clerk_dev');
-- 7. Verify clerk schemas are preserved (should show clerk and clerk_dev)
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('clerk', 'clerk_dev');

-- =============================================================================
-- Next Steps
-- =============================================================================

-- After running this cleanup script, you can now apply the new schema files:
-- 1. Run the schema files in supabase/schemas/ directory
-- 2. The declarative approach will create all necessary objects
-- 3. All existing data will be lost - this is a fresh start

-- =============================================================================
-- Notes
-- =============================================================================

-- This cleanup script completely removes all existing database objects
-- to prepare for a fresh declarative schema migration.
--
-- IMPORTANT: This will delete ALL data in your database!
-- Make sure to backup your database before running this script.
--
-- After running this script, you can apply the new schema files
-- in the supabase/schemas/ directory using Supabase's declarative approach.
