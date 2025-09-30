/**
 * Hubble Auth Package - Main Export
 *
 * This package provides authentication and organization management utilities
 * for the Hubble application. It handles user context, organization identification,
 * and authentication-related functionality.
 *
 * Modules:
 * - getOrgId: Organization ID retrieval utilities
 * - jwt-utils: JWT token utilities for claim extraction
 * - clerk-schema: Clerk schema environment detection utilities
 */

export * from "./getOrgId" // Organization ID utilities
export * from "./jwt-utils" // JWT token utilities for claim extraction
export * from "./clerk-schema" // Clerk schema utilities
