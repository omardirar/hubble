-- Grant necessary permissions for service_role on events table
-- This allows the service client to read events for SSE streaming

-- Grant SELECT permission on events table to service_role
GRANT SELECT ON TABLE public.events TO service_role;

-- Also grant SELECT permission to authenticated users (for completeness)
GRANT SELECT ON TABLE public.events TO authenticated;

-- Grant INSERT permission on events table to service_role (for writing events)
GRANT INSERT ON TABLE public.events TO service_role;

-- Grant INSERT permission on events table to authenticated users (for completeness)
GRANT INSERT ON TABLE public.events TO authenticated;
