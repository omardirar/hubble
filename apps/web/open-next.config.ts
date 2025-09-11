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
  // Prefer minified outputs for smaller artifacts
  default: {
    ...(base.default ?? {}),
    runtime: "node",
    minify: true,
    experimentalBundledNextServer: true,
  },
  // Keep middleware external and minified
  middleware: {
    ...(base.middleware ?? {}),
    external: true,
    minify: true,
  },
}

export default config
