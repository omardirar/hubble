import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    return (await auth()).protect()
  }
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
