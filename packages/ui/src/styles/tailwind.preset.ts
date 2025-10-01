// Centralized Tailwind preset and design tokens for Hubble UI
// - Defines CSS variables for light/dark and maps them to Tailwind theme colors
// - Provides consistent radii, fonts, container, and utility animations
// - Consuming apps should include this preset in their Tailwind config

import plugin from "tailwindcss/plugin"

// Cast to any to avoid leaking Tailwind's internal types to dependents during TS checks
const preset: any = {
  future: {
    // Keep Tailwind v4 behaviors predictable across apps
  },
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",

        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        // App navigation theme tokens
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Common shadcn interaction keyframes (kept minimal, most animations come from tw-animate-css)
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      boxShadow: {
        xs: "0 1px 2px 0 oklch(0 0 0 / 0.03)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    // Inject base design tokens (light/dark) via CSS variables
    plugin(function ({ addBase }) {
      addBase({
        ":root": {
          // Sizing
          "--radius": "0.625rem",

          // Semantic palette (light)
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",

          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",

          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",

          "--primary": "oklch(0.205 0 0)",
          "--primary-foreground": "oklch(0.985 0 0)",

          "--secondary": "oklch(0.97 0 0)",
          "--secondary-foreground": "oklch(0.205 0 0)",

          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",

          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",

          "--destructive": "oklch(0.577 0.245 27.325)",
          "--destructive-foreground": "oklch(0.985 0 0)",

          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",

          // Data visualization
          "--chart-1": "oklch(0.646 0.222 41.116)",
          "--chart-2": "oklch(0.6 0.118 184.704)",
          "--chart-3": "oklch(0.398 0.07 227.392)",
          "--chart-4": "oklch(0.828 0.189 84.429)",
          "--chart-5": "oklch(0.769 0.188 70.08)",

          // Sidebar theme (light)
          "--sidebar": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.205 0 0)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        ".dark": {
          // Semantic palette (dark)
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",

          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",

          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",

          "--primary": "oklch(0.922 0 0)",
          "--primary-foreground": "oklch(0.205 0 0)",

          "--secondary": "oklch(0.269 0 0)",
          "--secondary-foreground": "oklch(0.985 0 0)",

          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",

          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",

          "--destructive": "oklch(0.704 0.191 22.216)",
          "--destructive-foreground": "oklch(0.985 0 0)",

          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",

          // Data visualization
          "--chart-1": "oklch(0.488 0.243 264.376)",
          "--chart-2": "oklch(0.696 0.17 162.48)",
          "--chart-3": "oklch(0.769 0.188 70.08)",
          "--chart-4": "oklch(0.627 0.265 303.9)",
          "--chart-5": "oklch(0.645 0.246 16.439)",

          // Sidebar theme (dark)
          "--sidebar": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.488 0.243 264.376)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
        // Sensible defaults for border and background
        "*, ::before, ::after": {
          borderColor: "var(--border)",
        },
        body: {
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        },
      })
    }),
  ],
}

export default preset
