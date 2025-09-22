-- =============================================================================
-- Database Maintenance Operations for Supabase
-- =============================================================================
--
-- IMPORTANT: VACUUM operations are restricted in Supabase managed databases.
-- Use the following approaches instead of VACUUM commands.
-- =============================================================================

-- =============================================================================
-- APPROACH 1: Update Statistics Only (Recommended)
-- =============================================================================
-- This is the safest approach for Supabase managed databases

-- Update statistics for all tables (this usually works)
ANALYZE;

-- =============================================================================
-- APPROACH 2: Individual Table Statistics (if ANALYZE fails)
-- =============================================================================
-- If the above fails, try updating statistics for individual tables:

-- ANALYZE core.organizations;
-- ANALYZE core.organization_quotas;
-- ANALYZE connect.data_destinations;
-- ANALYZE connect.data_connections;
-- ANALYZE chat.conversations;
-- ANALYZE chat.messages;
-- ANALYZE system.audit_events;
-- ANALYZE system.secrets;
-- ANALYZE system.idempotency;

-- =============================================================================
-- APPROACH 3: Check Table Bloat (Diagnostic)
-- =============================================================================
-- Use this query to check if tables need maintenance:

-- SELECT
--     schemaname,
--     tablename,
--     n_dead_tup,
--     n_live_tup,
--     ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) AS dead_tuple_percent
-- FROM pg_stat_user_tables
-- WHERE schemaname IN ('core', 'connect', 'chat', 'system')
-- ORDER BY dead_tuple_percent DESC;

-- =============================================================================
-- APPROACH 4: Supabase Dashboard Maintenance
-- =============================================================================
-- For actual VACUUM operations, use the Supabase Dashboard:
-- 1. Go to Database > Settings
-- 2. Use the "Restart" option to trigger maintenance
-- 3. Or contact Supabase support for pg_repack operations

-- =============================================================================
-- Notes
-- =============================================================================
--
-- 1. VACUUM commands are restricted in Supabase managed databases
-- 2. ANALYZE is usually sufficient for most maintenance needs
-- 3. For heavy VACUUM operations, use Supabase Dashboard restart or contact support
-- 4. The restart option triggers automatic maintenance including VACUUM
-- 5. pg_repack is available but requires CLI access or support assistance
