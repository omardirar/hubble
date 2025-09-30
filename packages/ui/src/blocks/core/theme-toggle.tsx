"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Switch } from "../../ui/switch"

export function ModeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Only run on client-side
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Determine if dark mode is active
  const isDarkMode = theme === "dark" || (theme === "system" && systemTheme === "dark")

  // Handle switch change
  const handleThemeChange = (checked: boolean) => {
    // Get current effective theme (resolving system)
    const currentEffectiveTheme = theme === "system" ? systemTheme : theme

    // Toggle between light and dark, but store in sessionStorage
    const newTheme = checked ? "dark" : "light"

    // Only update if it's different from the current effective theme
    if (newTheme !== currentEffectiveTheme) {
      setTheme(newTheme)

      // Store in sessionStorage only if user explicitly changed it
      if (typeof window !== "undefined") {
        sessionStorage.setItem("theme", newTheme)
      }
    }
  }

  // On mount, check sessionStorage for theme preference
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTheme = sessionStorage.getItem("theme")
      if (storedTheme && (storedTheme === "light" || storedTheme === "dark")) {
        setTheme(storedTheme)
      } else {
        // Default to system if no session preference
        setTheme("system")
      }
    }
  }, [setTheme])

  // Prevent hydration mismatch
  if (!mounted) {
    return <Switch id="theme-toggle" disabled thumbContent={<Sun className="size-3" />} />
  }

  return (
    <Switch
      id="theme-toggle"
      checked={isDarkMode}
      onCheckedChange={handleThemeChange}
      thumbContent={isDarkMode ? <Moon className="size-3" /> : <Sun className="size-3" />}
    />
  )
}
