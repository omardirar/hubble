/**
 * Next.js Configuration for Hubble Web Application
 *
 * This configuration file defines the build and runtime settings for the
 * Hubble web application. It includes security headers, CSP policies,
 * and monorepo package transpilation settings.
 *
 * Key Features:
 * - Security headers and CSP policies
 * - Monorepo package transpilation
 * - Cloudflare Workers compatibility
 * - Clerk authentication integration
 * - Development and production optimizations
 */

import type { NextConfig } from "next"
import { config } from "dotenv"
import path from "path"

// Load environment variables from project root
config({ path: path.resolve(process.cwd(), "../../.env.local") })

const nextConfig: NextConfig = {
  // Runtime hardening and ergonomics
  poweredByHeader: false, // Remove X-Powered-By header for security
  reactStrictMode: true, // Enable React strict mode for better development

  // Ensure monorepo packages are transpiled by Next/Turbopack
  // to allow importing TS sources directly from workspaces
  transpilePackages: [
    "@hubble/ui", // UI components package
    "@hubble/utils", // Utility functions package
    "@hubble/config", // Configuration management package
    "@hubble/db", // Database client package
    "@hubble/schemas", // Schema definitions
    "@hubble/auth", // Authentication utilities
    "@hubble/core", // Core utilities
    "@hubble/chat", // Chat utilities
    "@hubble/types", // Type definitions
    // Note: @hubble/connect, @hubble/server, and @hubble/infrastructure are server-only
  ],

  // Webpack configuration to externalize native dependencies
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize DuckDB Node.js dependencies for server-side only
      config.externals = config.externals || []
      config.externals.push({
        "@duckdb/node-api": "commonjs @duckdb/node-api",
        "@duckdb/node-bindings": "commonjs @duckdb/node-bindings",
        "@duckdb/node-bindings-darwin-arm64": "commonjs @duckdb/node-bindings-darwin-arm64",
        "@duckdb/node-bindings-darwin-x64": "commonjs @duckdb/node-bindings-darwin-x64",
        "@duckdb/node-bindings-linux-x64": "commonjs @duckdb/node-bindings-linux-x64",
        "@duckdb/node-bindings-linux-arm64": "commonjs @duckdb/node-bindings-linux-arm64",
        "@duckdb/node-bindings-win32-x64": "commonjs @duckdb/node-bindings-win32-x64",
      })
    }
    return config
  },
  /**
   * Security headers configuration
   *
   * This function generates security headers for all routes, including
   * Content Security Policy (CSP) directives that are compatible with
   * Clerk authentication and Cloudflare Workers deployment.
   */
  async headers() {
    const isProd = process.env.NODE_ENV === "production"

    // Allow Clerk assets and Next.js dev features (HMR, inline/eval in dev)
    const cspDirectives = [
      "default-src 'self'", // Default source policy
      "base-uri 'self'", // Base URI policy
      "object-src 'none'", // No object/embed tags
      "frame-ancestors 'self'", // Frame embedding policy

      // Images and fonts
      "img-src 'self' data: https:", // Images from self, data URLs, and HTTPS
      "font-src 'self' data: https:", // Fonts from self, data URLs, and HTTPS

      // Scripts: allow Clerk CDN + inline scripts for Next.js production builds
      [
        "script-src",
        "'self'",
        "'unsafe-inline'", // Required for Next.js inline scripts in production
        isProd ? null : "'unsafe-eval'", // Only allow eval in development
        "https://*.clerk.com", // Clerk CDN scripts
        "https://*.clerk.accounts.dev", // Clerk accounts scripts
        "https://*.hubble.systems", // self-hosted clerk scripts
        "https://*.vercel.app", // Allow connections to vercel.app domain
        // Some dev tooling may use blob: URLs
        isProd ? null : "blob:",
      ]
        .filter(Boolean)
        .join(" "),

      // Styles
      ["style-src", "'self'", "'unsafe-inline'", "https:", isProd ? null : "blob:"]
        .filter(Boolean)
        .join(" "),

      // XHR/WebSocket connections (HMR + Clerk API + Vercel)
      [
        "connect-src",
        "'self'",
        "https://api.clerk.com", // Clerk API endpoints
        "https://*.clerk.com", // Clerk CDN connections
        "https://*.clerk.accounts.dev", // Clerk accounts connections
        "https://*.vercel.app", // Allow connections to vercel.app domains
        "https://*.hubble.systems", // Allow connections to self-hosted domain
        isProd ? null : "ws://localhost:*", // WebSocket for HMR in development
        isProd ? null : "http://localhost:*", // HTTP for HMR in development
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

    // Join all CSP directives with semicolons
    const csp = cspDirectives.join("; ")

    // Return security headers for all routes
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" }, // Prevent clickjacking
          { key: "X-Content-Type-Options", value: "nosniff" }, // Prevent MIME sniffing
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // Control referrer information
          { key: "Permissions-Policy", value: "geolocation=()" }, // Disable geolocation
          { key: "Content-Security-Policy", value: csp }, // Content Security Policy
        ],
      },
    ]
  },
}

export default nextConfig
