/**
 * Organization ID Utilities
 *
 * This module provides utilities for retrieving the current user's organization ID
 * from authentication context. It integrates with Clerk for user and organization
 * management.
 */

import { createServiceClient } from "@hubble/db"

/**
 * Determines the appropriate Clerk schema name based on the current environment.
 */
function getClerkSchemaName(): string {
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
 */
function getClerkTableName(tableName: string): string {
  const schema = getClerkSchemaName()
  return `${schema}.${tableName}`
}

/**
 * Retrieves the organization ID for a specific user from Clerk data.
 *
 * This function queries the Clerk mirror tables in Supabase to find
 * the organization that the user belongs to. It first checks for an
 * active organization membership, then falls back to the user's
 * primary organization if available.
 *
 * @param userId - The Clerk user ID to look up
 * @returns Promise that resolves to the organization ID, or null if not found
 */
export async function getOrgId(userId: string): Promise<string | null> {
  const supabase = createServiceClient()

  // First, try to find an active organization membership
  const { data: membership } = await supabase
    .from(getClerkTableName("organization_memberships"))
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (membership?.organization_id) {
    return membership.organization_id
  }

  // Fallback: check if user has a primary organization
  const { data: user } = await supabase
    .from(getClerkTableName("users"))
    .select("primary_organization_id")
    .eq("user_id", userId)
    .single()

  return user?.primary_organization_id || null
}

/**
 * Extracts user ID and organization ID from a JWT token using Clerk's JWT template.
 *
 * This function uses the extractJWTClaims utility to extract user and organization
 * information directly from the JWT token. With Clerk's JWT template configured
 * to include organization data, we no longer need to query the database.
 *
 * @param token - The JWT token from the Authorization header
 * @returns Promise that resolves to user and organization info, or null if not found
 */
export async function getUserAndOrgFromToken(token: string): Promise<{
  userId: string
  orgId: string
} | null> {
  try {
    // Import extractJWTClaims to avoid circular dependency
    const { extractJWTClaims } = await import("./jwt-utils")

    // Extract user and organization information from JWT token
    const claims = extractJWTClaims(token)

    if (!claims.userId || !claims.orgId) {
      return null
    }

    return {
      userId: claims.userId,
      orgId: claims.orgId,
    }
  } catch (error) {
    console.error("Error extracting user and org from token:", error)
    return null
  }
}

/**
 * @example
 * ```ts
 * const orgId = await getCurrentOrgId()
 * if (orgId) {
 *   // User is in an organization context
 *   console.log(`Current org: ${orgId}`)
 * } else {
 *   // User is not in an organization or not authenticated
 *   console.log("No organization context")
 * }
 * ```
 */
export async function getCurrentOrgId(): Promise<string | null> {
  // This function can only be used in server-side contexts (API routes, server components)
  // For client-side usage, use a different pattern (e.g., React hooks with useAuth)

  // Ensure we're running on the server
  if (typeof window !== "undefined") {
    console.warn("getCurrentOrgId cannot be called from client-side code")
    return null
  }

  try {
    // Dynamic import to avoid circular dependencies and only load when needed
    const { auth } = await import("@clerk/nextjs/server")
    const { userId } = await auth()

    if (!userId) {
      return null
    }

    // Use the existing getOrgId function to fetch from database
    return await getOrgId(userId)
  } catch (error) {
    console.warn("getCurrentOrgId failed - ensure Clerk auth context is available:", error)
    return null
  }
}
