"use client"

import Link from "next/link"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"
import { Telescope } from "lucide-react"
import { ModeToggle } from "./theme-toggle"

export function Header({ hasClerk = false }: { hasClerk?: boolean }) {
  return (
    <div className="bg-sidebar text-sidebar-foreground sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-screen-2xl items-center px-4">
        <Link href="/" className="text-sm font-semibold flex items-center gap-2">
          <Telescope className="size-4" />
          hubble
        </Link>
        <span className="text-muted-foreground px-2">/</span>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
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
