/**
 * Simplified Environment Management for Vercel Deployment
 *
 * This module provides a cleaner, Vercel-focused approach to environment
 * variable management, removing Cloudflare-specific patterns and simplifying
 * the API for better developer experience.
 */

import { z } from "zod"

// Server-side environment variables schema
const serverEnvSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  ANTHROPIC_MODEL: z.string().optional().default("claude-3-5-sonnet-latest"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
})

// Public environment variables schema
const publicEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  // Note: NEXT_PUBLIC_API_BASE_URL is no longer required with Related Projects
  // NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type PublicEnv = z.infer<typeof publicEnvSchema>

// Cache for parsed environment variables
let serverEnvCache: ServerEnv | null = null
let publicEnvCache: PublicEnv | null = null

/**
 * Get server environment variables with validation and caching
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() can only be called on the server")
  }

  if (serverEnvCache) {
    return serverEnvCache
  }

  try {
    serverEnvCache = serverEnvSchema.parse(process.env)
    return serverEnvCache
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join("\n")
      throw new Error(`Invalid environment variables:\n${missingVars}`)
    }
    throw error
  }
}

/**
 * Get public environment variables with validation and caching
 */
export function getPublicEnv(): PublicEnv {
  if (publicEnvCache) {
    return publicEnvCache
  }

  try {
    publicEnvCache = publicEnvSchema.parse(process.env)
    return publicEnvCache
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join("\n")
      throw new Error(`Invalid public environment variables:\n${missingVars}`)
    }
    throw error
  }
}

/**
 * Get Supabase configuration for server-side usage
 */
export function getSupabaseConfig() {
  const env = getServerEnv()
  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

/**
 * Get Anthropic configuration for AI requests
 */
export function getAnthropicConfig() {
  const env = getServerEnv()
  return {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
  }
}

/**
 * Get Clerk configuration for authentication
 */
export function getClerkConfig() {
  const serverEnv = getServerEnv()
  const publicEnv = getPublicEnv()
  return {
    secretKey: serverEnv.CLERK_SECRET_KEY,
    publishableKey: publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }
}

/**
 * Clear environment caches (for testing)
 */
export function clearEnvCache() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearEnvCache() can only be called in test environment")
  }
  serverEnvCache = null
  publicEnvCache = null
}
