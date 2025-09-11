import { useMemo } from "react"
import { createBrowserClient } from "@hubble/db"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Hook to get a Supabase browser client for client-side operations
 * @param options Optional configuration for the client
 * @returns Supabase client instance
 */
export function useSupabase(options?: { authToken?: string; region?: string }): SupabaseClient {
  return useMemo(() => {
    return createBrowserClient(options)
  }, [options?.authToken, options?.region])
}

/**
 * Hook to get a Supabase browser client with authentication token
 * @param token JWT token for authenticated requests
 * @returns Supabase client instance with auth token
 */
export function useSupabaseWithAuth(token?: string): SupabaseClient {
  return useSupabase({ authToken: token })
}
