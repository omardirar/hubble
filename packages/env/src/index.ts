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
})

type PublicEnv = z.infer<typeof publicSchema>
type ServerEnv = z.infer<typeof serverSchema>

let _publicEnvCache: PublicEnv | null = null
let _serverEnvCache: ServerEnv | null = null

// TODO: Add strict required-env helper with friendly errors
//   Context: Provide getRequiredEnv(name) that throws with actionable guidance and examples.
//   labels: area/env, feature/config, type/quality
//   assignees: omzification
//   milestone: 0.0.1

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

// TODO: Support runtime refresh of env caches in dev
//   Context: Add invalidateEnvCaches() to reset cached values for tests and hot reload scenarios.
//   labels: area/env, feature/devx, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

export type { PublicEnv, ServerEnv }
