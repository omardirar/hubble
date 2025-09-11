import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { getRequiredEnv, getSupabaseEnv } from "@hubble/env"

/**
 * Creates a Supabase client with service role privileges for server-side usage.
 * This client bypasses RLS policies and should only be used in secure server contexts.
 *
 * @returns Typed Supabase client with service role authentication
 * @throws Error if required environment variables are missing or if called on client-side
 */
export function createServiceClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createServiceClient() must only be called on the server")
  }

  const { url, anonKey } = getSupabaseEnv()
  const serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
