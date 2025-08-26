"use client"

import Link from "next/link"
import { OrgSwitcher } from "@/components/org-switcher"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

export function SiteHeader() {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-screen-2xl items-center px-4">
        <Link href="/" className="text-sm font-semibold">hubble</Link>
        <span className="px-2 text-muted-foreground">/</span>
        <OrgSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <SignedOut>
            <SignInButton mode="modal"/>
          </SignedOut>
          <SignedIn>
            <UserButton appearance={{ theme: shadcn }} />
          </SignedIn>
        </div>
      </div>
    </div>
  )
}
