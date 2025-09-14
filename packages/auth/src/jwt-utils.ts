/**
 * @interface JWTClaims
 * @description Defines the structure of the claims expected in the JWT payload.
 * Based on Clerk's JWT template structure as documented at:
 * https://clerk.com/docs/customization/templates/jwt-templates
 *
 * @property {string} userId - The subject (sub) claim, representing the user ID.
 * @property {string | undefined} orgId - The organization ID from the 'org_id' claim.
 * @property {string | undefined} orgRole - The user's role in the organization from 'org_role'.
 * @property {string | undefined} orgSlug - The organization slug from 'org_slug'.
 */
export interface JWTClaims {
  userId: string
  orgId: string | undefined
  orgRole: string | undefined
  orgSlug: string | undefined
}

/**
 * Decodes a JWT token's payload without verifying its signature.
 * This is used for extracting claims in the API worker, where Supabase
 * will perform the actual signature verification.
 *
 * @param token The JWT token string.
 * @returns The decoded payload as a JSON object.
 * @throws Error if the token is invalid or cannot be decoded.
 */
export function decodeJWTPayload(token: string): any {
  if (!token) {
    throw new Error("JWT token is missing.")
  }
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format.")
  }
  try {
    // Use built-in atob function instead of js-base64 to avoid bundling issues
    return JSON.parse(atob(parts[1]))
  } catch (error) {
    throw new Error(
      `Failed to decode JWT payload: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Extracts user ID and organization information from a decoded JWT payload.
 * This function extracts organization claims from Clerk's JWT template.
 * Based on the official Clerk documentation at:
 * https://clerk.com/docs/customization/templates/jwt-templates
 *
 * @param token The JWT token string.
 * @returns An object containing the userId and organization information.
 * @throws Error if userId is missing from the JWT payload.
 */
export function extractJWTClaims(token: string): JWTClaims {
  const payload = decodeJWTPayload(token)
  const userId = payload.sub

  // Clerk stores organization information directly in the JWT payload
  // Based on the official documentation, the structure is:
  // {
  //   "sub": "user_123",           // User ID
  //   "org_id": "org_123",         // Organization ID
  //   "org_slug": "example-org",   // Organization slug
  //   "org_role": "admin",         // User's role in the organization
  //   "o": {                       // Organization object (alternative structure)
  //     "id": "org_123",
  //     "rol": "admin",
  //     "slg": "example-org"
  //   }
  // }

  if (!userId) {
    throw new Error("User ID (sub) not found in JWT payload.")
  }

  // Try to get organization info from direct claims first, then fall back to 'o' object
  // This handles both Clerk JWT template structures
  const orgId = payload.org_id || payload.o?.id
  const orgRole = payload.org_role || payload.o?.rol
  const orgSlug = payload.org_slug || payload.o?.slg

  // Validate that we have the required organization information
  if (!orgId) {
    throw new Error(
      "Organization ID not found in JWT payload. Ensure Clerk JWT template includes org_id or o.id claim.",
    )
  }

  return {
    userId,
    orgId,
    orgRole,
    orgSlug,
  }
}
