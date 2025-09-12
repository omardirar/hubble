import { z } from "zod"

// Public (client-exposed) vars must be prefixed with NEXT_PUBLIC_
const publicSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
})

// Server-only vars. Keep optional at the schema level; dedicated helpers
// below will enforce requiredness where appropriate.
const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
})

type PublicEnv = z.infer<typeof publicSchema>
type ServerEnv = z.infer<typeof serverSchema>

let _publicEnvCache: PublicEnv | null = null
let _serverEnvCache: ServerEnv | null = null

export function getRequiredEnv<T extends keyof (ServerEnv & PublicEnv)>(
  name: T,
  options?: { allowPublicFallback?: boolean },
): string {
  ensureServerOnly("getRequiredEnv")
  const allowPublicFallback = options?.allowPublicFallback ?? false

  // Check server environment first
  const server = readServerEnv()
  if (name in server) {
    const serverValue = server[name as keyof ServerEnv]
    if (serverValue) {
      return serverValue
    }
  }

  // Check public environment if fallback is allowed
  if (allowPublicFallback) {
    const pub = readPublicEnv()
    if (name in pub) {
      const publicValue = pub[name as keyof PublicEnv]
      if (publicValue) {
        return publicValue
      }
    }
  }

  // Generate friendly error message with examples
  const publicPrefix = name.startsWith("NEXT_PUBLIC_") ? "" : "NEXT_PUBLIC_"
  const publicName = publicPrefix + name

  throw new Error(
    `Missing required environment variable: ${name}\n\n` +
      `Set one of the following:\n` +
      `  ${name}=your_value_here (server-only)\n` +
      (allowPublicFallback ? `  ${publicName}=your_value_here (public)\n` : "") +
      `\nExample:\n` +
      `  ${name}=supabase_service_role_key_here\n` +
      `\nNote: Server-only variables are not exposed to the client.`,
  )
}

export function readPublicEnv(): PublicEnv {
  if (_publicEnvCache) return _publicEnvCache
  // In Next.js, process.env is replaced at build-time for NEXT_PUBLIC_*
  _publicEnvCache = publicSchema.parse({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  return _publicEnvCache
}

function ensureServerOnly(fnName: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${fnName} must only be called on the server`)
  }
}

export function readServerEnv(): ServerEnv {
  ensureServerOnly("readServerEnv")
  if (_serverEnvCache) return _serverEnvCache
  _serverEnvCache = serverSchema.parse({
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  return _serverEnvCache
}

// Convenience helpers with clear requiredness and friendly errors.

export function getSupabaseEnv(options?: { allowPublicFallback?: boolean }) {
  ensureServerOnly("getSupabaseEnv")
  const allowPublicFallback = options?.allowPublicFallback ?? true

  const server = readServerEnv()
  const pub = allowPublicFallback ? readPublicEnv() : undefined

  const url = server.SUPABASE_URL ?? pub?.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = server.SUPABASE_ANON_KEY ?? pub?.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set SUPABASE_URL (server) or NEXT_PUBLIC_SUPABASE_URL (public).",
    )
  }
  if (!anonKey) {
    throw new Error(
      "Missing Supabase anon key. Set SUPABASE_ANON_KEY (server) or NEXT_PUBLIC_SUPABASE_ANON_KEY (public).",
    )
  }

  // Validate URL shape explicitly (zod url already validated if present via schema)
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid Supabase URL: not a valid URL")
  }

  return { url, anonKey }
}

export function getAnthropicEnv() {
  ensureServerOnly("getAnthropicEnv")
  const { ANTHROPIC_API_KEY } = readServerEnv()
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY")
  }
  return { apiKey: ANTHROPIC_API_KEY, model }
}

export function invalidateEnvCaches() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("invalidateEnvCaches() is only available in development mode")
  }
  _publicEnvCache = null
  _serverEnvCache = null
}

// Type-safe environment variable accessors
export function getServerEnvVar<T extends keyof ServerEnv>(name: T): ServerEnv[T] | undefined {
  ensureServerOnly("getServerEnvVar")
  const server = readServerEnv()
  return server[name]
}

export function getPublicEnvVar<T extends keyof PublicEnv>(name: T): PublicEnv[T] | undefined {
  const pub = readPublicEnv()
  return pub[name]
}

// Secrets Store integration for Cloudflare Workers
export interface SecretsStoreEnv {
  CLERK_SECRET_KEY: { get(): Promise<string | null> }
  ANTHROPIC_API_KEY: { get(): Promise<string | null> }
  SUPABASE_URL: { get(): Promise<string | null> }
  SUPABASE_ANON_KEY: { get(): Promise<string | null> }
  SUPABASE_SERVICE_ROLE_KEY: { get(): Promise<string | null> }
}

// Async secret access functions for Cloudflare Workers
export async function getSecretValue<T extends keyof SecretsStoreEnv>(
  env: SecretsStoreEnv,
  secretName: T,
): Promise<string> {
  ensureServerOnly("getSecretValue")

  const secret = env[secretName]
  if (!secret) {
    throw new Error(`Secret binding '${secretName}' not found in environment`)
  }

  const value = await secret.get()
  if (!value) {
    throw new Error(`Secret '${secretName}' not found in Secrets Store`)
  }

  return value
}

export async function getSupabaseEnvFromSecrets(env: SecretsStoreEnv) {
  ensureServerOnly("getSupabaseEnvFromSecrets")

  const [url, anonKey] = await Promise.all([
    getSecretValue(env, "SUPABASE_URL"),
    getSecretValue(env, "SUPABASE_ANON_KEY"),
  ])

  // Validate URL shape
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid Supabase URL: not a valid URL")
  }

  return { url, anonKey }
}

export async function getAnthropicEnvFromSecrets(env: SecretsStoreEnv) {
  ensureServerOnly("getAnthropicEnvFromSecrets")

  const apiKey = await getSecretValue(env, "ANTHROPIC_API_KEY")
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"

  return { apiKey, model }
}

export async function getClerkSecretFromSecrets(env: SecretsStoreEnv) {
  ensureServerOnly("getClerkSecretFromSecrets")

  return await getSecretValue(env, "CLERK_SECRET_KEY")
}

export async function getSupabaseServiceRoleKeyFromSecrets(env: SecretsStoreEnv) {
  ensureServerOnly("getSupabaseServiceRoleKeyFromSecrets")

  return await getSecretValue(env, "SUPABASE_SERVICE_ROLE_KEY")
}

export type { PublicEnv, ServerEnv }
