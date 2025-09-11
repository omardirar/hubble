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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=()" },
          // Basic CSP placeholder; adjust once routes/assets finalized
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
