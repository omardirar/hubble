/**
 * Health Check API Route
 *
 * This endpoint provides a simple health check for the application.
 * It's used by load balancers, monitoring systems, and deployment
 * platforms to verify that the application is running and responsive.
 *
 * Features:
 * - Simple "ok" response for basic health verification
 * - No caching to ensure real-time health status
 * - Plain text response for easy parsing
 * - Compatible with Cloudflare Workers runtime
 *
 * Note: Cloudflare adapter handles runtime; avoid forcing edge at route level per OpenNext docs
 */

/**
 * Handle GET requests to /healthz
 *
 * Returns a simple "ok" response to indicate the application is healthy.
 * This endpoint is typically used by:
 * - Load balancers for health checks
 * - Monitoring systems for uptime verification
 * - Deployment platforms for readiness probes
 *
 * @returns Response with "ok" status
 */
export async function GET() {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8", // Plain text response
      "cache-control": "no-store", // No caching for real-time status
    },
  })
}
