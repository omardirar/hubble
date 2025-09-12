/**
 * Version Information API Route
 *
 * This endpoint provides version and build information about the application.
 * It's useful for debugging, monitoring, and deployment verification.
 *
 * Features:
 * - Application version from package.json
 * - Build timestamp
 * - Environment information
 * - Git commit and branch information (when available)
 * - JSON response for easy parsing
 *
 * Note: Cloudflare adapter handles runtime; avoid forcing edge at route level per OpenNext docs
 */

// Import version from package.json at build time
import packageJson from "../../../package.json"

/**
 * Handle GET requests to /version
 *
 * Returns comprehensive version and build information about the application.
 * This endpoint is useful for:
 * - Debugging and troubleshooting
 * - Deployment verification
 * - Monitoring and observability
 * - Development and testing
 *
 * @returns JSON response with version information
 */
export async function GET() {
  // Get the current build time
  const buildTime = new Date().toISOString()

  // Return comprehensive version information
  return Response.json({
    version: packageJson.version, // Application version from package.json
    buildTime, // When this build was created
    environment: process.env.NODE_ENV || "production", // Current environment
    // Include git info if available (from Vercel or other CI/CD platforms)
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown", // Git commit hash
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || "unknown", // Git branch name
  })
}
