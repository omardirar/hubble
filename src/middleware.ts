import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)", "/api/mcp"],
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!.*\\..*|_next).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}

// TODO: Add rate limiting middleware for APIs (429), see README guidance
//  labels: area:api, security, P1
//  assignees: me
//  milestone: M0 - Safety Net
//  evidence: src/middleware.ts — no limiter present


