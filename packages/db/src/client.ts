import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { readPublicEnv } from "@hubble/env"

/**
 * Creates a Supabase client for browser/client-side usage with anon key authentication.
 * This client respects RLS policies and is safe to use in client-side code.
 *
 * @param options Optional configuration for the client
 * @param options.authToken Optional JWT token for authenticated requests
 * @param options.region Optional region for the Supabase instance
 * @returns Typed Supabase client with anon key authentication
 * @throws Error if required environment variables are missing
 */
export function createBrowserClient(options?: {
  authToken?: string
  region?: string
}): SupabaseClient {
  const env = readPublicEnv()

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Set this environment variable in your .env.local file.\n\n" +
        "Example:\n" +
        "  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co",
    )
  }

  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Set this environment variable in your .env.local file.\n\n" +
        "Example:\n" +
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here",
    )
  }

  const clientOptions: any = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }

  // Add auth token if provided
  if (options?.authToken) {
    clientOptions.global = {
      headers: {
        Authorization: `Bearer ${options.authToken}`,
      },
    }
  }

  // Add region if provided
  if (options?.region) {
    clientOptions.db = {
      schema: options.region,
    }
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions,
  )
}
