/**
 * Supabase client creation for browser/client-side usage
 *
 * This module provides functions to create Supabase clients for client-side
 * usage with proper authentication and RLS policy enforcement. It supports
 * both traditional environment variables and Cloudflare Secrets Store.
 *
 * Architecture:
 * - Browser clients use anon key authentication and respect RLS policies
 * - JWT tokens can be provided for authenticated requests using accessToken
 * - Two methods: traditional env vars and Secrets Store (for Cloudflare Workers)
 * - All clients are configured for optimal browser usage (auto-refresh, persistence)
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  readPublicEnv,
  getSupabaseEnvFromSecrets,
  getSupabaseEnvWithFallback,
  ensureServerOnly,
  type SecretsStoreEnv,
} from "@hubble/env"

/**
 * Creates a Supabase client for browser/client-side usage with anon key authentication.
 *
 * This client is designed for use in browser environments and respects Row Level
 * Security (RLS) policies. It uses the anonymous key which is safe to expose
 * to the client and provides automatic token refresh and session persistence.
 *
 * Security considerations:
 * - Uses anonymous key (safe for client-side exposure)
 * - Respects RLS policies for data access control
 * - JWT tokens can be provided for authenticated requests via accessToken
 * - No service role key (prevents privilege escalation)
 *
 * @param options Optional configuration for the client
 * @param options.authToken Optional JWT token for authenticated requests
 * @returns Typed Supabase client with anon key authentication
 * @throws Error if required environment variables are missing
 */
export function createBrowserClient(options?: { authToken?: string }): SupabaseClient {
  // Read public environment variables (safe for client-side exposure)
  const env = readPublicEnv()

  // Note: In the proxy architecture, browser clients should not directly connect to Supabase
  // This function is kept for potential future use but is not recommended in the current architecture

  // Configure client options for optimal browser usage
  const clientOptions: any = {
    auth: {
      autoRefreshToken: true, // Automatically refresh expired tokens
      persistSession: true, // Persist session across browser refreshes
    },
  }

  // Add JWT token to requests if provided (for authenticated operations)
  if (options?.authToken) {
    // For third-party JWT tokens (like Clerk), we need to pass the token
    // in the Authorization header for Supabase to verify it and make it available to RLS
    clientOptions.global = {
      headers: {
        Authorization: `Bearer ${options.authToken}`,
      },
    }
  }

  // Note: Regions are handled by the Supabase URL configuration
  // The URL already contains the region information (e.g., https://project-id.supabase.co)

  // Create and return the Supabase client with anon key authentication
  // Note: This function is deprecated in the proxy architecture
  // Browser clients should not directly connect to Supabase
  throw new Error(
    "Direct Supabase client creation is not supported in the proxy architecture. " +
      "Use API routes instead of direct database access from the browser.",
  )
}

/**
 * Creates a Supabase client using Secrets Store for server-side usage with anon key authentication.
 *
 * This function is designed for Cloudflare Workers and other server-side environments
 * that use Cloudflare's Secrets Store for secure secret management. It provides the
 * same functionality as createBrowserClient but retrieves credentials from Secrets Store.
 *
 * Security considerations:
 * - Uses anonymous key (safe for client-side exposure)
 * - Respects RLS policies for data access control
 * - JWT tokens can be provided for authenticated requests via accessToken
 * - Secrets are retrieved asynchronously from Cloudflare Secrets Store
 * - No service role key (prevents privilege escalation)
 *
 * @param env - Cloudflare Workers environment with Secrets Store bindings
 * @param options Optional configuration for the client
 * @param options.authToken Optional JWT token for authenticated requests
 * @returns Promise that resolves to a typed Supabase client with anon key authentication
 * @throws Error if required secrets are missing
 */
export async function createBrowserClientFromSecrets(
  env: SecretsStoreEnv,
  options?: { authToken?: string },
): Promise<SupabaseClient> {
  // Retrieve Supabase configuration from Cloudflare Secrets Store
  const { url, anonKey } = await getSupabaseEnvFromSecrets(env)

  // Configure client options for optimal browser usage
  const clientOptions: any = {
    auth: {
      autoRefreshToken: true, // Automatically refresh expired tokens
      persistSession: true, // Persist session across browser refreshes
    },
  }

  // Add JWT token to requests if provided (for authenticated operations)
  if (options?.authToken) {
    // For third-party JWT tokens (like Clerk), we need to pass the token
    // in the Authorization header for Supabase to verify it and make it available to RLS
    clientOptions.global = {
      headers: {
        Authorization: `Bearer ${options.authToken}`,
      },
    }
  }

  // Create and return the Supabase client with anon key authentication
  return createSupabaseClient(url, anonKey, clientOptions)
}

/**
 * Create a Supabase browser client with fallback to environment variables
 *
 * This function creates a Supabase client that works in both deployed and
 * local development environments. It tries Secrets Store first, then falls
 * back to environment variables for local development.
 *
 * @param env - The Cloudflare Workers environment object
 * @param options - Optional configuration for the client
 * @returns Promise that resolves to a configured Supabase client
 * @throws Error if neither secrets nor environment variables are found
 */
export async function createBrowserClientWithFallback(
  env: SecretsStoreEnv,
  options?: { authToken?: string },
): Promise<SupabaseClient> {
  // Ensure this function is only called on the server
  ensureServerOnly("createBrowserClientWithFallback")

  // Get Supabase configuration with fallback support
  const { url, anonKey } = await getSupabaseEnvWithFallback(env)

  // Configure client options for optimal browser usage
  const clientOptions: any = {
    auth: {
      autoRefreshToken: true, // Automatically refresh expired tokens
      persistSession: true, // Persist session across browser refreshes
    },
  }

  // Add JWT token to requests if provided (for authenticated operations)
  if (options?.authToken) {
    // For third-party JWT tokens (like Clerk), we need to pass the token
    // in the Authorization header for Supabase to verify it and make it available to RLS
    clientOptions.global = {
      headers: {
        Authorization: `Bearer ${options.authToken}`,
      },
    }
  }

  // Create and return the Supabase client with anon key authentication
  return createSupabaseClient(url, anonKey, clientOptions)
}
