/**
 * Environment variable and secret management for Hubble
 *
 * This package provides centralized access to environment variables and secrets
 * across the Hubble application, with support for both traditional environment
 * variables and Cloudflare's Secrets Store for sensitive data.
 *
 * Architecture:
 * - Environment variables: Public configuration (NEXT_PUBLIC_*, API_BASE_URL, etc.)
 * - Secrets Store: Sensitive data (API keys, database credentials, etc.)
 * - Type safety: Zod schemas ensure runtime validation of environment values
 * - Async access: Secrets Store requires async retrieval, so all secret access is async
 * - Caching: Environment variables are cached to avoid repeated parsing
 * - Server-only enforcement: Sensitive operations are restricted to server-side only
 */

import { z } from "zod"

// Public (client-exposed) vars must be prefixed with NEXT_PUBLIC_
// These are safe to expose to the browser and are injected at build time by Next.js
// Used for client-side authentication, API endpoints, and public configuration
const publicSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(), // Clerk authentication public key
})

// Server-only vars. Keep optional at the schema level; dedicated helpers
// below will enforce requiredness where appropriate.
// These contain sensitive data and should never be exposed to the client
const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().optional(), // Clerk secret key for server-side auth verification
  ANTHROPIC_API_KEY: z.string().optional(), // Anthropic API key for AI chat functionality
  SUPABASE_URL: z.url().optional(), // Supabase project URL (server-side)
  SUPABASE_ANON_KEY: z.string().optional(), // Supabase anonymous key (server-side)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // Supabase service role key for admin operations
})

// TypeScript types derived from Zod schemas for type safety
type PublicEnv = z.infer<typeof publicSchema>
type ServerEnv = z.infer<typeof serverSchema>

// Cache for parsed environment variables to avoid repeated parsing
// These are module-level caches that persist for the lifetime of the module
let _publicEnvCache: PublicEnv | null = null
let _serverEnvCache: ServerEnv | null = null

/**
 * Get a required environment variable with fallback support
 *
 * This function enforces that a required environment variable is present,
 * with optional fallback to public environment variables for certain cases.
 *
 * @param name - The name of the environment variable to retrieve
 * @param options - Configuration options
 * @param options.allowPublicFallback - Whether to allow fallback to public env vars
 * @returns The environment variable value as a string
 * @throws Error if the variable is not found and no fallback is available
 */
export function getRequiredEnv<T extends keyof (ServerEnv & PublicEnv)>(
  name: T,
  options?: { allowPublicFallback?: boolean },
): string {
  // Ensure this function is only called on the server to prevent client-side exposure
  ensureServerOnly("getRequiredEnv")
  const allowPublicFallback = options?.allowPublicFallback ?? false

  // Check server environment first (preferred for sensitive data)
  const server = readServerEnv()
  if (name in server) {
    const serverValue = server[name as keyof ServerEnv]
    if (serverValue) {
      return serverValue
    }
  }

  // Check public environment if fallback is allowed (for non-sensitive data)
  if (allowPublicFallback) {
    const pub = readPublicEnv()
    if (name in pub) {
      const publicValue = pub[name as keyof PublicEnv]
      if (publicValue) {
        return publicValue
      }
    }
  }

  // Generate friendly error message with examples to help developers
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

/**
 * Read and parse public environment variables
 *
 * Public environment variables are safe to expose to the client and are
 * injected at build time by Next.js. This function caches the parsed
 * result to avoid repeated parsing.
 *
 * @returns Parsed public environment variables
 */
export function readPublicEnv(): PublicEnv {
  // Return cached result if available
  if (_publicEnvCache) return _publicEnvCache

  // In Next.js, process.env is replaced at build-time for NEXT_PUBLIC_*
  // This means these values are baked into the client bundle
  _publicEnvCache = publicSchema.parse({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  })
  return _publicEnvCache
}

/**
 * Ensure a function is only called on the server
 *
 * This is a security measure to prevent sensitive operations from being
 * executed on the client side where they could expose secrets.
 *
 * @param fnName - The name of the function being called (for error messages)
 * @throws Error if called on the client side
 */
export function ensureServerOnly(fnName: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${fnName} must only be called on the server`)
  }
}

/**
 * Read and parse server-only environment variables
 *
 * Server environment variables contain sensitive data and should never
 * be exposed to the client. This function enforces server-only execution
 * and caches the parsed result.
 *
 * @returns Parsed server environment variables
 * @throws Error if called on the client side
 */
export function readServerEnv(): ServerEnv {
  // Ensure this function is only called on the server
  ensureServerOnly("readServerEnv")

  // Return cached result if available
  if (_serverEnvCache) return _serverEnvCache

  // Parse and validate server environment variables
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
// These functions provide easy access to commonly used environment configurations
// with proper validation and helpful error messages.

/**
 * Get Supabase environment configuration with fallback support
 *
 * This function retrieves Supabase URL and anonymous key, with optional
 * fallback to public environment variables. This is useful for cases where
 * the same Supabase configuration is needed on both server and client.
 *
 * @param options - Configuration options
 * @param options.allowPublicFallback - Whether to allow fallback to public env vars (default: true)
 * @returns Object containing Supabase URL and anonymous key
 * @throws Error if required values are missing or invalid
 */
export function getSupabaseEnv(options?: { allowPublicFallback?: boolean }) {
  // Ensure this function is only called on the server
  ensureServerOnly("getSupabaseEnv")
  const allowPublicFallback = options?.allowPublicFallback ?? true

  // Read both server and public environment variables
  const server = readServerEnv()
  const pub = allowPublicFallback ? readPublicEnv() : undefined

  // Use server environment variables only (no public fallback needed in proxy architecture)
  const url = server.SUPABASE_URL
  const anonKey = server.SUPABASE_ANON_KEY

  // Validate that required values are present
  if (!url) {
    throw new Error("Missing Supabase URL. Set SUPABASE_URL (server).")
  }
  if (!anonKey) {
    throw new Error("Missing Supabase anon key. Set SUPABASE_ANON_KEY (server).")
  }

  // Validate URL shape explicitly (zod url already validated if present via schema)
  // This provides an additional layer of validation
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid Supabase URL: not a valid URL")
  }

  return { url, anonKey }
}

/**
 * Get Anthropic API configuration
 *
 * Retrieves the Anthropic API key and model configuration for AI chat functionality.
 * The model defaults to Claude 3.5 Sonnet if not specified.
 *
 * @returns Object containing API key and model name
 * @throws Error if API key is missing
 */
export function getAnthropicEnv() {
  // Ensure this function is only called on the server
  ensureServerOnly("getAnthropicEnv")

  // Read server environment variables
  const { ANTHROPIC_API_KEY } = readServerEnv()

  // Use configured model or default to Claude 3.5 Sonnet
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"

  // Validate that API key is present
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY")
  }

  return { apiKey: ANTHROPIC_API_KEY, model }
}

/**
 * Invalidate environment variable caches (development only)
 *
 * This function clears the cached environment variables, forcing them to be
 * re-parsed on the next access. Only available in development mode for
 * testing purposes.
 *
 * @throws Error if called in production
 */
export function invalidateEnvCaches() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("invalidateEnvCaches() is only available in development mode")
  }
  _publicEnvCache = null
  _serverEnvCache = null
}

// Type-safe environment variable accessors
// These functions provide direct access to specific environment variables
// with full TypeScript type safety

/**
 * Get a server environment variable by name
 *
 * @param name - The name of the server environment variable
 * @returns The environment variable value or undefined if not set
 */
export function getServerEnvVar<T extends keyof ServerEnv>(name: T): ServerEnv[T] | undefined {
  ensureServerOnly("getServerEnvVar")
  const server = readServerEnv()
  return server[name]
}

/**
 * Get a public environment variable by name
 *
 * @param name - The name of the public environment variable
 * @returns The environment variable value or undefined if not set
 */
export function getPublicEnvVar<T extends keyof PublicEnv>(name: T): PublicEnv[T] | undefined {
  const pub = readPublicEnv()
  return pub[name]
}

// Secrets Store integration for Cloudflare Workers
// This interface defines the structure of environment bindings for Cloudflare Workers
// that use the Secrets Store for sensitive data management

/**
 * Interface for Cloudflare Workers environment with Secrets Store bindings
 *
 * Each property represents a secret binding that can be accessed asynchronously
 * through the Cloudflare Secrets Store. The get() method returns a Promise that
 * resolves to the secret value or null if not found.
 */
export interface SecretsStoreEnv {
  CLERK_SECRET_KEY: { get(): Promise<string | null> } // Clerk authentication secret key
  ANTHROPIC_API_KEY: { get(): Promise<string | null> } // Anthropic API key for AI chat
  SUPABASE_URL: { get(): Promise<string | null> } // Supabase project URL
  SUPABASE_ANON_KEY: { get(): Promise<string | null> } // Supabase anonymous key
  SUPABASE_SERVICE_ROLE_KEY: { get(): Promise<string | null> } // Supabase service role key for admin operations
}

// Async secret access functions for Cloudflare Workers
// These functions provide type-safe access to secrets stored in Cloudflare's Secrets Store

/**
 * Get a secret value from Cloudflare Secrets Store
 *
 * This function provides generic access to any secret in the Secrets Store.
 * It handles validation and provides helpful error messages.
 *
 * @param env - The Cloudflare Workers environment object
 * @param secretName - The name of the secret to retrieve
 * @returns Promise that resolves to the secret value
 * @throws Error if the secret binding is not found or the secret doesn't exist
 */
export async function getSecretValue<T extends keyof SecretsStoreEnv>(
  env: SecretsStoreEnv,
  secretName: T,
): Promise<string> {
  // Ensure this function is only called on the server
  ensureServerOnly("getSecretValue")

  // Get the secret binding from the environment
  const secret = env[secretName]
  if (!secret) {
    throw new Error(`Secret binding '${secretName}' not found in environment`)
  }

  // Retrieve the secret value asynchronously
  const value = await secret.get()
  if (!value) {
    throw new Error(`Secret '${secretName}' not found in Secrets Store`)
  }

  return value
}

/**
 * Get a secret value with fallback to environment variables
 *
 * This function tries to get a secret from Cloudflare Secrets Store first,
 * then falls back to regular environment variables for local development.
 * This allows the same code to work in both deployed and local environments.
 *
 * @param env - The Cloudflare Workers environment object
 * @param secretName - The name of the secret to retrieve
 * @param envVarName - The environment variable name to fallback to
 * @returns Promise that resolves to the secret value
 * @throws Error if neither secret nor environment variable is found
 */
export async function getSecretValueWithFallback(
  env: SecretsStoreEnv,
  secretName: keyof SecretsStoreEnv,
  envVarName: string,
): Promise<string> {
  // Ensure this function is only called on the server
  ensureServerOnly("getSecretValueWithFallback")

  // Check if we're in local development mode (no Secrets Store bindings)
  const isLocalDev = !env[secretName] || typeof env[secretName]?.get !== "function"

  if (isLocalDev) {
    // Local development: use environment variables directly
    const envValue = process.env[envVarName]
    if (envValue) {
      return envValue
    }

    throw new Error(
      `Environment variable '${envVarName}' not set for local development. ` +
        `Set ${envVarName} in your .env.local file or shell environment.`,
    )
  }

  // Deployed environment: try Secrets Store first
  try {
    const secret = env[secretName]
    if (secret && typeof secret.get === "function") {
      const value = await secret.get()
      if (value) {
        return value
      }
    }
  } catch (error) {
    // Secrets Store failed, try environment variable as fallback
    const envValue = process.env[envVarName]
    if (envValue) {
      return envValue
    }
  }

  // Neither source available
  throw new Error(
    `Secret '${secretName}' not found in Secrets Store and environment variable '${envVarName}' not set. ` +
      `For local development, set ${envVarName} in your .env file or shell environment.`,
  )
}

/**
 * Get Supabase environment configuration from Secrets Store
 *
 * Retrieves Supabase URL and anonymous key from Cloudflare Secrets Store.
 * This is the preferred method for Cloudflare Workers as it provides
 * secure, centralized secret management.
 *
 * @param env - The Cloudflare Workers environment object
 * @returns Promise that resolves to Supabase configuration
 * @throws Error if secrets are missing or invalid
 */
export async function getSupabaseEnvFromSecrets(env: SecretsStoreEnv) {
  // Ensure this function is only called on the server
  ensureServerOnly("getSupabaseEnvFromSecrets")

  // Retrieve both secrets in parallel for better performance
  const [url, anonKey] = await Promise.all([
    getSecretValue(env, "SUPABASE_URL"),
    getSecretValue(env, "SUPABASE_ANON_KEY"),
  ])

  // Validate URL shape to ensure it's a valid URL
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid Supabase URL: not a valid URL")
  }

  return { url, anonKey }
}

/**
 * Get Supabase environment configuration with fallback to environment variables
 *
 * This function tries to get Supabase configuration from Secrets Store first,
 * then falls back to regular environment variables for local development.
 * This allows the same code to work in both deployed and local environments.
 *
 * @param env - The Cloudflare Workers environment object
 * @returns Promise that resolves to Supabase configuration
 * @throws Error if neither secrets nor environment variables are found
 */
export async function getSupabaseEnvWithFallback(env: SecretsStoreEnv) {
  // Ensure this function is only called on the server
  ensureServerOnly("getSupabaseEnvWithFallback")

  // Check if we're in local development mode
  const isLocalDev = !env.SUPABASE_URL || typeof env.SUPABASE_URL?.get !== "function"

  if (isLocalDev) {
    // Local development: use environment variables directly
    const url = process.env.SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      throw new Error(
        `Missing environment variables for local development. ` +
          `Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env.local file.`,
      )
    }

    // Validate URL shape to ensure it's a valid URL
    try {
      new URL(url)
    } catch {
      throw new Error("Invalid Supabase URL: not a valid URL")
    }

    return { url, anonKey }
  }

  // Deployed environment: use Secrets Store
  const [url, anonKey] = await Promise.all([
    getSecretValueWithFallback(env, "SUPABASE_URL", "SUPABASE_URL"),
    getSecretValueWithFallback(env, "SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
  ])

  // Validate URL shape to ensure it's a valid URL
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid Supabase URL: not a valid URL")
  }

  return { url, anonKey }
}

/**
 * Get Anthropic API configuration from Secrets Store
 *
 * Retrieves the Anthropic API key from Cloudflare Secrets Store and
 * combines it with the model configuration for AI chat functionality.
 *
 * @param env - The Cloudflare Workers environment object
 * @returns Promise that resolves to Anthropic configuration
 * @throws Error if API key is missing
 */
export async function getAnthropicEnvFromSecrets(env: SecretsStoreEnv) {
  // Ensure this function is only called on the server
  ensureServerOnly("getAnthropicEnvFromSecrets")

  // Check if we're in local development mode
  const isLocalDev = !env.ANTHROPIC_API_KEY || typeof env.ANTHROPIC_API_KEY?.get !== "function"

  if (isLocalDev) {
    // Local development: use environment variables directly
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        `Missing ANTHROPIC_API_KEY for local development. ` +
          `Set ANTHROPIC_API_KEY in your .env.local file.`,
      )
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"
    return { apiKey, model }
  }

  // Deployed environment: use Secrets Store
  const apiKey = await getSecretValue(env, "ANTHROPIC_API_KEY")
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"

  return { apiKey, model }
}

/**
 * Get Clerk secret key from Secrets Store
 *
 * Retrieves the Clerk secret key from Cloudflare Secrets Store for
 * server-side authentication verification.
 *
 * @param env - The Cloudflare Workers environment object
 * @returns Promise that resolves to the Clerk secret key
 * @throws Error if secret is missing
 */
export async function getClerkSecretFromSecrets(env: SecretsStoreEnv) {
  // Ensure this function is only called on the server
  ensureServerOnly("getClerkSecretFromSecrets")

  return await getSecretValue(env, "CLERK_SECRET_KEY")
}

/**
 * Get Supabase service role key from Secrets Store
 *
 * Retrieves the Supabase service role key from Cloudflare Secrets Store.
 * This key has admin privileges and should only be used for server-side
 * operations that require elevated permissions.
 *
 * @param env - The Cloudflare Workers environment object
 * @returns Promise that resolves to the service role key
 * @throws Error if secret is missing
 */
export async function getSupabaseServiceRoleKeyFromSecrets(env: SecretsStoreEnv) {
  // Ensure this function is only called on the server
  ensureServerOnly("getSupabaseServiceRoleKeyFromSecrets")

  return await getSecretValue(env, "SUPABASE_SERVICE_ROLE_KEY")
}

export type { PublicEnv, ServerEnv }
