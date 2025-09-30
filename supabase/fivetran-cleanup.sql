-- =============================================================================
-- Fivetran Legacy Cleanup
-- =============================================================================
-- This file removes deprecated Fivetran views and related objects that have
-- been replaced by the simplified v_fivetran_connection_overview view.
--
-- Run this after deploying the new simplified fivetran-views.sql migration.
--
-- IMPORTANT: Only run this once you've confirmed the new simplified view is
-- working correctly in your application.
-- =============================================================================

-- =============================================================================
-- Drop Legacy Views (Public Schema)
-- =============================================================================

-- Drop public schema mirrors of old views
DROP VIEW IF EXISTS public.v_fivetran_connection_status CASCADE;
DROP VIEW IF EXISTS public.v_fivetran_sync_health CASCADE;
DROP VIEW IF EXISTS public.v_fivetran_usage_metrics CASCADE;

-- =============================================================================
-- Drop Legacy Views (Connect Schema)
-- =============================================================================

-- Drop connect schema views (if they still exist after CASCADE)
DROP VIEW IF EXISTS connect.v_fivetran_connection_status CASCADE;
DROP VIEW IF EXISTS connect.v_fivetran_sync_health CASCADE;
DROP VIEW IF EXISTS connect.v_fivetran_usage_metrics CASCADE;

-- =============================================================================
-- Revoke Permissions on Legacy Views
-- =============================================================================
-- These may fail if views are already dropped, which is fine

DO $$ BEGIN
  -- Revoke from public schema views
  REVOKE ALL ON TABLE public.v_fivetran_connection_status FROM authenticated;
  REVOKE ALL ON TABLE public.v_fivetran_sync_health FROM authenticated;
  REVOKE ALL ON TABLE public.v_fivetran_usage_metrics FROM authenticated;
  REVOKE ALL ON TABLE public.v_fivetran_connection_status FROM service_role;
  REVOKE ALL ON TABLE public.v_fivetran_sync_health FROM service_role;
  REVOKE ALL ON TABLE public.v_fivetran_usage_metrics FROM service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  -- Revoke from connect schema views
  REVOKE ALL ON TABLE connect.v_fivetran_connection_status FROM authenticated;
  REVOKE ALL ON TABLE connect.v_fivetran_sync_health FROM authenticated;
  REVOKE ALL ON TABLE connect.v_fivetran_usage_metrics FROM authenticated;
  REVOKE ALL ON TABLE connect.v_fivetran_connection_status FROM service_role;
  REVOKE ALL ON TABLE connect.v_fivetran_sync_health FROM service_role;
  REVOKE ALL ON TABLE connect.v_fivetran_usage_metrics FROM service_role;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Verification
-- =============================================================================
-- Query to verify cleanup was successful

DO $$
DECLARE
  legacy_view_count integer;
BEGIN
  -- Count remaining legacy views
  SELECT COUNT(*) INTO legacy_view_count
  FROM information_schema.views
  WHERE table_schema IN ('public', 'connect')
    AND table_name IN (
      'v_fivetran_connection_status',
      'v_fivetran_sync_health',
      'v_fivetran_usage_metrics'
    );

  IF legacy_view_count > 0 THEN
    RAISE WARNING 'Legacy views still exist: % views found', legacy_view_count;
  ELSE
    RAISE NOTICE 'Cleanup successful: All legacy Fivetran views removed';
  END IF;

  -- Verify new view exists
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'connect'
      AND table_name = 'v_fivetran_connection_overview'
  ) THEN
    RAISE NOTICE 'New view confirmed: connect.v_fivetran_connection_overview exists';
  ELSE
    RAISE WARNING 'New view missing: connect.v_fivetran_connection_overview not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'v_fivetran_connection_overview'
  ) THEN
    RAISE NOTICE 'New view confirmed: public.v_fivetran_connection_overview exists';
  ELSE
    RAISE WARNING 'New view missing: public.v_fivetran_connection_overview not found';
  END IF;
END $$;

-- =============================================================================
-- Summary
-- =============================================================================
-- The following legacy objects have been removed:
--
-- Views Removed:
--   - public.v_fivetran_connection_status
--   - public.v_fivetran_sync_health
--   - public.v_fivetran_usage_metrics
--   - connect.v_fivetran_connection_status
--   - connect.v_fivetran_sync_health
--   - connect.v_fivetran_usage_metrics
--
-- Views Retained:
--   - connect.v_fivetran_connection_overview (NEW - simplified)
--   - public.v_fivetran_connection_overview (NEW - public mirror)
--
-- Note: The new simplified view provides all essential Fivetran data:
--   - Connector identifiers
--   - Status (active, paused, deleted, not_configured)
--   - Last synced timestamp (_fivetran_synced)
--   - Sync frequency
--   - Connector type and metadata
-- =============================================================================
