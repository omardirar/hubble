/**
 * Supabase client creation for browser/client-side usage
 *
 * This module provides functions to create Supabase clients for client-side
 * usage with proper authentication and RLS policy enforcement using Vercel
 * environment variables.
 *
 * Architecture:
 * - Browser clients use anon key authentication and respect RLS policies
 * - JWT tokens can be provided for authenticated requests using accessToken
 * - All clients are configured for optimal browser usage (auto-refresh, persistence)
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

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
  // Get Supabase configuration from environment variables
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable")
  }
  if (!anonKey) {
    throw new Error("Missing SUPABASE_ANON_KEY environment variable")
  }

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

  // Create the Supabase client with anon key authentication
  const client = createSupabaseClient(url, anonKey, clientOptions)

  // Note: Environment variable for schema selection defaults to 'development'
  // which uses clerk_dev schema. For production, the environment variable
  // should be set to 'production' to use the clerk schema.

  return client
}

// TODO: Add connection pooling and retry logic
//   Context: Implement connection pooling and automatic retry for failed database operations.
//   labels: area/db, feature/performance, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1
