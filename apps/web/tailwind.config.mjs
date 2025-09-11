import preset from "@hubble/ui/tailwind.preset"

const config = {
  // Ensure Tailwind scans both the app and shared UI package
  content: ["./src/**/*.{ts,tsx,mdx}", "../../packages/ui/src/**/*.{ts,tsx,mdx}"],
  // Optionally pull in shared theme extensions (kept minimal here)
  presets: [preset],
}

export default config
