-- Grant permissions for tenant_destinations table to service_role
-- This is needed for the provisioning workflow to access the tenant_destinations table

-- Grant table permissions
GRANT INSERT ON TABLE public.tenant_destinations TO service_role;
GRANT UPDATE ON TABLE public.tenant_destinations TO service_role;
GRANT SELECT ON TABLE public.tenant_destinations TO service_role;
GRANT DELETE ON TABLE public.tenant_destinations TO service_role;

-- Add RLS policies for service_role
-- The original migration only had SELECT policy for authenticated users

-- INSERT policy for service_role
DROP POLICY IF EXISTS dest_insert_service_role ON public.tenant_destinations;
CREATE POLICY dest_insert_service_role
  ON public.tenant_destinations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE policy for service_role
DROP POLICY IF EXISTS dest_update_service_role ON public.tenant_destinations;
CREATE POLICY dest_update_service_role
  ON public.tenant_destinations FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE policy for service_role
DROP POLICY IF EXISTS dest_delete_service_role ON public.tenant_destinations;
CREATE POLICY dest_delete_service_role
  ON public.tenant_destinations FOR DELETE
  TO service_role
  USING (true);
