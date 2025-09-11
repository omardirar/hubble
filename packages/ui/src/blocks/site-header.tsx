"use client"

import Link from "next/link"
import { OrgSwitcher } from "./org-switcher"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

export function SiteHeader() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  return (
    <div className="bg-sidebar text-sidebar-foreground sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-screen-2xl items-center px-4">
        <Link href="/" className="text-sm font-semibold">
          hubble
        </Link>
        <span className="text-muted-foreground px-2">/</span>
        <OrgSwitcher />
        <div className="ml-auto flex items-center gap-2">
          {hasClerk ? (
            <>
              <SignedOut>
                <SignInButton mode="modal" />
              </SignedOut>
              <SignedIn>
                <UserButton appearance={{ baseTheme: shadcn }} />
              </SignedIn>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
