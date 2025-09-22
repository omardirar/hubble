-- =============================================================================
-- Cleanup Script: Remove Legacy/Unused Database Objects
-- =============================================================================
-- This script removes legacy and unused database objects after the refined schema
-- migration has been completed and all code has been updated to use the new schema.

-- WARNING: This script should only be run after:
-- 1. All new migrations have been applied successfully
-- 2. All application code has been updated to use the new schema
-- 3. Data migration has been verified to be complete
-- 4. All functionality has been tested with the new schema

-- =============================================================================
-- Drop Legacy Tables
-- =============================================================================

-- Drop old public schema tables (after data migration is complete)
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.tenant_provisioning CASCADE;
DROP TABLE IF EXISTS public.tenant_destinations CASCADE;
DROP TABLE IF EXISTS public.provisioning_runs CASCADE;
DROP TABLE IF EXISTS public.connections CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.service_secrets CASCADE;
DROP TABLE IF EXISTS public.source_types CASCADE;
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
DROP TABLE IF EXISTS public.tenant_quotas CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;

-- =============================================================================
-- Drop Legacy Views
-- =============================================================================

-- Drop old views (these should be replaced by new schema views)
DROP VIEW IF EXISTS public.v_tenants CASCADE;
DROP VIEW IF EXISTS public.v_tenant_destinations CASCADE;
DROP VIEW IF EXISTS public.v_connections CASCADE;
DROP VIEW IF EXISTS public.conversation_summaries CASCADE;

-- =============================================================================
-- Drop Legacy Functions
-- =============================================================================

-- Drop old functions that are no longer needed
DROP FUNCTION IF EXISTS public.set_events_created_on() CASCADE;
DROP FUNCTION IF EXISTS public.set_event_seq() CASCADE;
DROP FUNCTION IF EXISTS public.messages_apply_parent_context() CASCADE;
DROP FUNCTION IF EXISTS public.touch_conversation_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.block_message_move() CASCADE;
DROP FUNCTION IF EXISTS public.check_archive_has_messages() CASCADE;
DROP FUNCTION IF EXISTS public.set_conversations_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_messages_updated_at() CASCADE;

-- =============================================================================
-- Drop Legacy Types
-- =============================================================================

-- Drop old enum types (these are now in their respective schemas)
DROP TYPE IF EXISTS public.tenant_status_t CASCADE;
DROP TYPE IF EXISTS public.dest_status_t CASCADE;
DROP TYPE IF EXISTS public.conn_status_t CASCADE;
DROP TYPE IF EXISTS public.run_status_t CASCADE;

-- =============================================================================
-- Drop Legacy Triggers
-- =============================================================================

-- Note: Triggers are automatically dropped when their tables are dropped
-- This section is for reference only

-- =============================================================================
-- Drop Legacy Policies
-- =============================================================================

-- Note: RLS policies are automatically dropped when their tables are dropped
-- This section is for reference only

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

-- =============================================================================
-- Clean Up Unused Extensions
-- =============================================================================

-- Note: Be careful with extensions as they might be used by other parts of the system
-- Only drop if you're certain they're not needed

-- =============================================================================
-- Clean Up Orphaned Indexes
-- =============================================================================

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

-- =============================================================================
-- Clean Up Orphaned Constraints
-- =============================================================================

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

-- =============================================================================
-- Clean Up Orphaned Functions
-- =============================================================================

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

-- Drop any empty schemas that might be left over
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public', 'core', 'connect', 'chat', 'system', 'clerk', 'clerk_dev', 'extensions', 'graphql_public', 'graphql', 'realtime', 'storage', 'vault', 'supabase_functions', 'supabase_migrations', 'auth', 'pgsodium', 'pgsodium_masks', 'net', 'pgtap')
        AND nspname NOT LIKE 'pg_%'
        AND nspname NOT LIKE 'supabase_%'
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            WHERE c.relnamespace = pg_namespace.oid
        )
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(schema_record.nspname) || ' CASCADE';
    END LOOP;
END $$;

-- =============================================================================
-- Final Cleanup
-- =============================================================================

-- Note: VACUUM operations have been moved to vacuum.sql to avoid transaction block issues

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Run these queries to verify cleanup was successful:

-- 1. Check for remaining tables in public schema
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Check for remaining functions in public schema
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';

-- 3. Check for remaining views in public schema
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

-- 4. Check for remaining sequences in public schema
-- SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';

-- 5. Check for remaining types in public schema
-- SELECT type_name FROM information_schema.types WHERE type_schema = 'public';

-- =============================================================================
-- Notes
-- =============================================================================

-- This cleanup script should be run in a maintenance window
-- Make sure to backup the database before running this script
-- Test the script on a staging environment first
-- Monitor the application after running to ensure everything still works
-- Consider running this in smaller chunks if the database is large
--
-- IMPORTANT: After running this cleanup script, run vacuum.sql separately
-- to perform VACUUM ANALYZE operations that cannot run in transaction blocks.
