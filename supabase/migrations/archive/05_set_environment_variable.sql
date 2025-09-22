-- Set environment variable for schema selection
-- This allows the database functions to determine which Clerk schema to use

-- Set the environment based on NODE_ENV and VERCEL_ENV
-- This should be called by the application when connecting to the database
-- Example: SELECT set_config('app.environment', 'development', false);

-- Create a helper function to set the environment
CREATE OR REPLACE FUNCTION public.set_app_environment(env text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Set the environment variable for the current session
  PERFORM set_config('app.environment', env, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.set_app_environment(text) TO authenticated, anon, service_role;

-- Set default environment to 'production' if not set
-- This ensures backward compatibility
SELECT set_config('app.environment', 'production', false);
