/**
 * Clerk Schema Environment Detection
 *
 * This module provides utilities for determining which Clerk schema to use
 * based on the current environment. In development and preview environments,
 * we use the `clerk_dev` schema, while in production we use the `clerk` schema.
 */

/**
 * Determines the appropriate Clerk schema name based on the current environment.
 *
 * Environment detection logic:
 * - Development: NODE_ENV === 'development' → clerk_dev
 * - Preview: VERCEL_ENV === 'preview' → clerk_dev
 * - Production: All other cases → clerk
 *
 * @returns The schema name to use for Clerk operations
 */
export function getClerkSchemaName(): string {
  // Check for development environment
  if (process.env.NODE_ENV === "development") {
    return "clerk_dev"
  }

  // Check for Vercel preview environment
  if (process.env.VERCEL_ENV === "preview") {
    return "clerk_dev"
  }

  // Default to production schema
  return "clerk"
}

/**
 * Gets the full table name for a Clerk table based on the current environment.
 *
 * @param tableName - The base table name (e.g., 'organizations', 'users')
 * @returns The fully qualified table name with schema prefix
 */
export function getClerkTableName(tableName: string): string {
  const schema = getClerkSchemaName()
  return `${schema}.${tableName}`
}

/**
 * Gets the RPC function name for Clerk operations based on the current environment.
 *
 * @param functionName - The base function name (e.g., 'get_org_from_clerk_mirror')
 * @returns The function name (RPC functions are typically in the public schema)
 */
export function getClerkRpcName(functionName: string): string {
  // RPC functions are typically in the public schema, so we don't need to modify them
  // unless we create environment-specific versions
  return functionName
}

/**
 * Environment information for debugging and logging
 */
export function getClerkEnvironmentInfo() {
  return {
    schema: getClerkSchemaName(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isDevelopment: process.env.NODE_ENV === "development",
    isPreview: process.env.VERCEL_ENV === "preview",
    isProduction: process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview",
  }
}
