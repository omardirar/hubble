-- =============================================================================
-- Consolidated Row Level Security Policies
-- =============================================================================
-- This file contains all RLS policies for the Hubble application.

-- =============================================================================
-- Enable RLS on All Tables
-- =============================================================================

-- Core tables
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.provisioning_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.organization_quotas ENABLE ROW LEVEL SECURITY;

-- Connect tables
ALTER TABLE connect.data_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect.data_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect.connector_types ENABLE ROW LEVEL SECURITY;

-- System tables
ALTER TABLE system.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.rate_limits ENABLE ROW LEVEL SECURITY;

-- Chat tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Core Policies
-- =============================================================================

-- Organizations policies
DROP POLICY IF EXISTS organizations_select_org ON core.organizations;
CREATE POLICY organizations_select_org
  ON core.organizations FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS organizations_insert_org ON core.organizations;
CREATE POLICY organizations_insert_org
  ON core.organizations FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS organizations_update_org ON core.organizations;
CREATE POLICY organizations_update_org
  ON core.organizations FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

-- Provisioning workflows policies
DROP POLICY IF EXISTS provisioning_workflows_select_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_select_org
  ON core.provisioning_workflows FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_insert_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_insert_org
  ON core.provisioning_workflows FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_update_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_update_org
  ON core.provisioning_workflows FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS provisioning_workflows_delete_org ON core.provisioning_workflows;
CREATE POLICY provisioning_workflows_delete_org
  ON core.provisioning_workflows FOR DELETE
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Organization quotas policies
DROP POLICY IF EXISTS organization_quotas_select_org ON core.organization_quotas;
CREATE POLICY organization_quotas_select_org
  ON core.organization_quotas FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- =============================================================================
-- Connect Policies
-- =============================================================================

-- Data destinations policies
DROP POLICY IF EXISTS data_destinations_select_org ON connect.data_destinations;
CREATE POLICY data_destinations_select_org
  ON connect.data_destinations FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS data_destinations_insert_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_insert_service_role
  ON connect.data_destinations FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS data_destinations_update_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_update_service_role
  ON connect.data_destinations FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS data_destinations_delete_service_role ON connect.data_destinations;
CREATE POLICY data_destinations_delete_service_role
  ON connect.data_destinations FOR DELETE
  TO service_role
  USING (true);

-- Data connections policies
DROP POLICY IF EXISTS data_connections_select_org ON connect.data_connections;
CREATE POLICY data_connections_select_org
  ON connect.data_connections FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS data_connections_insert_org ON connect.data_connections;
CREATE POLICY data_connections_insert_org
  ON connect.data_connections FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS data_connections_update_org ON connect.data_connections;
CREATE POLICY data_connections_update_org
  ON connect.data_connections FOR UPDATE
  USING (org_id = (SELECT public.jwt_claim('org_id')))
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS data_connections_delete_org ON connect.data_connections;
CREATE POLICY data_connections_delete_org
  ON connect.data_connections FOR DELETE
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Connector types policies (read-only for all authenticated users)
DROP POLICY IF EXISTS connector_types_read_all ON connect.connector_types;
CREATE POLICY connector_types_read_all
  ON connect.connector_types FOR SELECT
  USING (true);

-- =============================================================================
-- System Policies
-- =============================================================================

-- Audit events policies
DROP POLICY IF EXISTS audit_events_select_org ON system.audit_events;
CREATE POLICY audit_events_select_org
  ON system.audit_events FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

DROP POLICY IF EXISTS audit_events_insert_org ON system.audit_events;
CREATE POLICY audit_events_insert_org
  ON system.audit_events FOR INSERT
  WITH CHECK (org_id = (SELECT public.jwt_claim('org_id')));

-- Secrets policies (service role only)
DROP POLICY IF EXISTS "Service role only" ON system.secrets;
CREATE POLICY "Service role only" ON system.secrets
  FOR ALL TO service_role USING (true);

-- Deny all other access to secrets
DROP POLICY IF EXISTS "Deny all other access" ON system.secrets;
CREATE POLICY "Deny all other access" ON system.secrets
  AS RESTRICTIVE TO public USING (false);

-- Idempotency keys policies
DROP POLICY IF EXISTS idempotency_keys_select_org ON system.idempotency_keys;
CREATE POLICY idempotency_keys_select_org
  ON system.idempotency_keys FOR SELECT
  USING (org_id = (SELECT public.jwt_claim('org_id')));

-- Rate limits policies (no access for regular users)
DROP POLICY IF EXISTS rate_limits_select_none ON system.rate_limits;
CREATE POLICY rate_limits_select_none ON system.rate_limits FOR SELECT USING (false);

-- =============================================================================
-- Chat Policies
-- =============================================================================

-- Conversations policies
DROP POLICY IF EXISTS public_conversations_select_own ON public.conversations;
CREATE POLICY public_conversations_select_own
  ON public.conversations FOR SELECT
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  );

DROP POLICY IF EXISTS public_conversations_insert_self ON public.conversations;
CREATE POLICY public_conversations_insert_self
  ON public.conversations FOR INSERT
  WITH CHECK (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  );

DROP POLICY IF EXISTS public_conversations_update_own ON public.conversations;
CREATE POLICY public_conversations_update_own
  ON public.conversations FOR UPDATE
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  )
  WITH CHECK (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  );

DROP POLICY IF EXISTS public_conversations_delete_own ON public.conversations;
CREATE POLICY public_conversations_delete_own
  ON public.conversations FOR DELETE
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  );

-- Messages policies
DROP POLICY IF EXISTS public_messages_select_own ON public.messages;
CREATE POLICY public_messages_select_own
  ON public.messages FOR SELECT
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
        AND c.org_id = (SELECT public.jwt_claim('org_id'))
    )
  );

DROP POLICY IF EXISTS public_messages_insert_own ON public.messages;
CREATE POLICY public_messages_insert_own
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
        AND c.org_id = (SELECT public.jwt_claim('org_id'))
    )
  );

DROP POLICY IF EXISTS public_messages_update_own ON public.messages;
CREATE POLICY public_messages_update_own
  ON public.messages FOR UPDATE
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
        AND c.org_id = (SELECT public.jwt_claim('org_id'))
    )
  )
  WITH CHECK (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
  );

DROP POLICY IF EXISTS public_messages_delete_own ON public.messages;
CREATE POLICY public_messages_delete_own
  ON public.messages FOR DELETE
  USING (
    owner_user_id = (SELECT public.jwt_claim('sub'))
    AND org_id = (SELECT public.jwt_claim('org_id'))
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND c.owner_user_id = (SELECT public.jwt_claim('sub'))
        AND c.org_id = (SELECT public.jwt_claim('org_id'))
    )
  );
