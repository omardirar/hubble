-- =============================================================================
-- Consolidated Initial Data
-- =============================================================================
-- This file contains all initial data, seed data, and reference data
-- for the Hubble application.

-- =============================================================================
-- Connector Types Data
-- =============================================================================

-- Insert default connector types
INSERT INTO connect.connector_types (code, label) VALUES
  ('facebook_ads', 'Facebook Ads'),
  ('google_ads', 'Google Ads'),
  ('tiktok_ads', 'TikTok Ads'),
  ('linkedin_ads', 'LinkedIn Ads')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- System Configuration
-- =============================================================================

-- Set default environment configuration
-- This will be overridden by actual environment variables in production
SELECT set_config('app.environment', 'development', false);

-- =============================================================================
-- Comments
-- =============================================================================

-- Add comments for reference data
COMMENT ON TABLE connect.connector_types IS 'Reference data for supported connector types';
COMMENT ON COLUMN connect.connector_types.code IS 'Unique identifier for connector type';
COMMENT ON COLUMN connect.connector_types.label IS 'Human-readable display name for connector type';
