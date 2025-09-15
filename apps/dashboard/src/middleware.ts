/**
 * Next.js Middleware for Authentication
 *
 * This middleware handles authentication and authorization for the Hubble web
 * application using Clerk. It protects private routes while allowing public
 * access to authentication pages and health check endpoints.
 *
 * Features:
 * - Route-based authentication protection
 * - Public route whitelist
 * - Automatic redirect to sign-in for protected routes
 * - Health check and version endpoints bypass
 * - Static file serving optimization
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

/**
 * Define public routes that don't require authentication
 *
 * These routes are accessible without being signed in:
 * - Root page (/)
 * - Authentication pages (/sign-in, /sign-up)
 * - Health check endpoint (/healthz)
 * - Version endpoint (/version)
 */
const isPublicRoute = createRouteMatcher([
  "/", // Root page
  "/sign-in(.*)", // Sign-in page and sub-routes
  "/sign-up(.*)", // Sign-up page and sub-routes
  "/healthz", // Health check endpoint
  "/version", // Version information endpoint
])

/**
 * Clerk middleware implementation
 *
 * This middleware runs on every request and checks if the route requires
 * authentication. If the route is not public, it enforces authentication
 * by calling auth.protect().
 *
 * @param auth - Clerk authentication context
 * @param req - Incoming request object
 */
export default clerkMiddleware(async (auth, req) => {
  // Check if the current route is public
  if (!isPublicRoute(req)) {
    // Protect the route - redirect to sign-in if not authenticated
    await auth.protect()
  }
})

/**
 * Middleware configuration
 *
 * This configuration defines which routes the middleware should run on.
 * It uses a complex regex pattern to exclude static files and Next.js
 * internals while ensuring it runs on all API routes and dynamic pages.
 */
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|map|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
