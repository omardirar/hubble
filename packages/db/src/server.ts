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

/**
 * Creates a Supabase client with service role privileges using Secrets Store.
 * This is the recommended approach for Cloudflare Workers with Secrets Store integration.
 *
 * @param env - Cloudflare Workers environment with Secrets Store bindings
 * @returns Promise that resolves to a typed Supabase client with service role authentication
 * @throws Error if required secrets are missing or if called on client-side
 */
export async function createServiceClientFromSecrets(
  env: SecretsStoreEnv,
): Promise<SupabaseClient> {
  if (typeof window !== "undefined") {
    throw new Error("createServiceClientFromSecrets() must only be called on the server")
  }

  const { url } = await getSupabaseEnvFromSecrets(env)
  const serviceKey = await getSupabaseServiceRoleKeyFromSecrets(env)

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
