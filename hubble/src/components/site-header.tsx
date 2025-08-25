"use client"

import Link from "next/link"
import { OrgSwitcher } from "@/components/org-switcher"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"

export function SiteHeader() {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-screen-2xl items-center px-4">
        <Link href="/" className="text-sm font-semibold">hubble</Link>
        <span className="px-2 text-muted-foreground">/</span>
        <OrgSwitcher />
        <span className="px-2 text-muted-foreground">/</span>
        <WorkspaceSwitcher />
      </div>
    </div>
  )
}
