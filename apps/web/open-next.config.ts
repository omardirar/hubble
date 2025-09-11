import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Start from the adapter defaults, then override selective fields to reduce size
const base = defineCloudflareConfig({
  enableCacheInterception: false,
}) as unknown as {
  default?: Record<string, unknown>
  middleware?: Record<string, unknown>
} & Record<string, unknown>

const config = {
  ...base,
  // Disable minification to work around OpenNext TypeScript file issues
  default: {
    ...(base.default ?? {}),
    runtime: "node",
    minify: false,
    // Remove experimentalBundledNextServer to fix file copying issues
    // This uses the standard Next.js server bundling approach
  },
  // Keep middleware external but disable minification for now
  middleware: {
    ...(base.middleware ?? {}),
    external: true,
    minify: false,
  },
}

export default config
