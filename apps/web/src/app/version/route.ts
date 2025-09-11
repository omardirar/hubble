// Cloudflare adapter handles runtime; avoid forcing edge at route level per OpenNext docs

// Import version from package.json at build time
import packageJson from "../../../package.json"

export async function GET() {
  const buildTime = new Date().toISOString()

  return Response.json({
    version: packageJson.version,
    buildTime,
    environment: process.env.NODE_ENV || "production",
    // Include git info if available
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
  })
}
