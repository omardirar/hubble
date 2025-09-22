-- Fix RLS policies for tenant_provisioning table
-- The current_org_id() function might not be working correctly with Clerk JWT tokens
-- Use JWT claims directly for more reliable organization ID extraction

-- Drop existing policies
DROP POLICY IF EXISTS tenant_provisioning_select_org ON public.tenant_provisioning;
DROP POLICY IF EXISTS tenant_provisioning_insert_org ON public.tenant_provisioning;
DROP POLICY IF EXISTS tenant_provisioning_update_org ON public.tenant_provisioning;

-- Create new policies using JWT claims directly
-- This is more reliable than the current_org_id() function
CREATE POLICY tenant_provisioning_select_org
  ON public.tenant_provisioning FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

CREATE POLICY tenant_provisioning_insert_org
  ON public.tenant_provisioning FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

CREATE POLICY tenant_provisioning_update_org
  ON public.tenant_provisioning FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));
