import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Runtime hardening and ergonomics
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  output: "standalone",
  // Ensure monorepo packages are transpiled by Next/Turbopack
  // to allow importing TS sources directly from workspaces
  transpilePackages: [
    "@hubble/ui",
    "@hubble/utils",
    "@hubble/env",
    "@hubble/db",
    "@hubble/workflows",
    "@hubble/api-contracts",
    "@hubble/auth",
  ],
  async headers() {
    const isProd = process.env.NODE_ENV === "production"
    // Allow Clerk assets and Next.js dev features (HMR, inline/eval in dev)
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      // Images and fonts
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      // Scripts: allow Clerk CDN + inline scripts for Next.js production builds
      [
        "script-src",
        "'self'",
        "'unsafe-inline'", // Required for Next.js inline scripts in production
        isProd ? null : "'unsafe-eval'", // Only allow eval in development
        "https://*.clerk.com",
        "https://*.clerk.accounts.dev",
        // Some dev tooling may use blob: URLs
        isProd ? null : "blob:",
      ]
        .filter(Boolean)
        .join(" "),
      // Styles
      ["style-src", "'self'", "'unsafe-inline'", "https:", isProd ? null : "blob:"]
        .filter(Boolean)
        .join(" "),
      // XHR/WebSocket connections (HMR + Clerk API + Workers.dev)
      [
        "connect-src",
        "'self'",
        "https://api.clerk.com",
        "https://*.clerk.com",
        "https://*.clerk.accounts.dev",
        "https://*.workers.dev", // Allow connections to workers.dev domains
        isProd ? null : "ws://localhost:*",
        isProd ? null : "http://localhost:*",
      ]
        .filter(Boolean)
        .join(" "),
      // Iframes (Clerk UI)
      ["frame-src", "'self'", "https://*.clerk.com", "https://*.clerk.accounts.dev"]
        .filter(Boolean)
        .join(" "),
      // Workers used by dev/runtime and Clerk
      ["worker-src", "'self'", "blob:"].filter(Boolean).join(" "),
    ]

    const csp = cspDirectives.join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
