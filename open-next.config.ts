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
  // Minify server bundle aggressively; try legacy bundled Next server to shrink size
  default: {
    ...(base.default ?? {}),
    runtime: "node",
    minify: false,
    experimentalBundledNextServer: false,
  },
  // Keep middleware external and minified
  middleware: {
    ...(base.middleware ?? {}),
    external: true,
    minify: false,
  },
}

export default config
