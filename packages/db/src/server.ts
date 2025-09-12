/**
 * Supabase client creation for server-side usage with elevated privileges
 *
 * This module provides functions to create Supabase clients for server-side
 * usage with service role privileges. These clients bypass Row Level Security
 * (RLS) policies and should only be used in secure server contexts.
 *
 * Architecture:
 * - Service clients use service role key for admin operations
 * - Bypass RLS policies (use with extreme caution)
 * - Two methods: traditional env vars and Secrets Store (for Cloudflare Workers)
 * - Server-only execution enforced for security
 * - No token refresh or session persistence (stateless server operations)
 *
 * Security Warning:
 * - Service role key has admin privileges
 * - Bypasses all RLS policies
 * - Should only be used for system operations, not user requests
 * - Never expose service role key to client-side code
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  getRequiredEnv,
  getSupabaseEnv,
  getSupabaseEnvFromSecrets,
  getSupabaseServiceRoleKeyFromSecrets,
  type SecretsStoreEnv,
} from "@hubble/env"

/**
 * Creates a Supabase client with service role privileges for server-side usage.
 *
 * This client has admin privileges and bypasses Row Level Security (RLS) policies.
 * It should only be used in secure server contexts for system operations, not
 * for handling user requests directly.
 *
 * Security considerations:
 * - Uses service role key (admin privileges)
 * - Bypasses RLS policies (use with extreme caution)
 * - Server-only execution enforced
 * - No token refresh or session persistence (stateless)
 * - Should only be used for system operations, not user requests
 *
 * @returns Typed Supabase client with service role authentication
 * @throws Error if required environment variables are missing or if called on client-side
 */
export function createServiceClient(): SupabaseClient {
  // Enforce server-only execution for security
  if (typeof window !== "undefined") {
    throw new Error("createServiceClient() must only be called on the server")
  }

  // Get Supabase configuration from environment variables
  const { url, anonKey } = getSupabaseEnv()

  // Get service role key (admin privileges)
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")

  // Create client with service role key and stateless configuration
  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false, // No token refresh needed for service role
      persistSession: false, // No session persistence for stateless server operations
    },
  })
}

/**
 * Creates a Supabase client with service role privileges using Secrets Store.
 *
 * This function is designed for Cloudflare Workers and other server-side environments
 * that use Cloudflare's Secrets Store for secure secret management. It provides the
 * same functionality as createServiceClient but retrieves credentials from Secrets Store.
 *
 * This is the recommended approach for Cloudflare Workers with Secrets Store integration.
 *
 * Security considerations:
 * - Uses service role key (admin privileges)
 * - Bypasses RLS policies (use with extreme caution)
 * - Server-only execution enforced
 * - Secrets retrieved asynchronously from Cloudflare Secrets Store
 * - No token refresh or session persistence (stateless)
 * - Should only be used for system operations, not user requests
 *
 * @param env - Cloudflare Workers environment with Secrets Store bindings
 * @returns Promise that resolves to a typed Supabase client with service role authentication
 * @throws Error if required secrets are missing or if called on client-side
 */
export async function createServiceClientFromSecrets(
  env: SecretsStoreEnv,
): Promise<SupabaseClient> {
  // Enforce server-only execution for security
  if (typeof window !== "undefined") {
    throw new Error("createServiceClientFromSecrets() must only be called on the server")
  }

  // Retrieve Supabase configuration from Cloudflare Secrets Store
  const { url } = await getSupabaseEnvFromSecrets(env)

  // Get service role key from Secrets Store (admin privileges)
  const serviceKey = await getSupabaseServiceRoleKeyFromSecrets(env)

  // Create client with service role key and stateless configuration
  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false, // No token refresh needed for service role
      persistSession: false, // No session persistence for stateless server operations
    },
  })
}
