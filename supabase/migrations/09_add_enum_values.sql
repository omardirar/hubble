-- Add new enum values for tenant status tracking
-- This migration adds 'running' and 'failed' values to the tenant_status_t enum

-- Add new status values to the enum
ALTER TYPE tenant_status_t ADD VALUE 'running';
ALTER TYPE tenant_status_t ADD VALUE 'failed';
