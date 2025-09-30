"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"
import {
  Telescope,
  LayoutDashboard,
  MessageCircle,
  Plug,
  Settings,
  CreditCard,
  Users,
  LifeBuoy,
  Send,
} from "lucide-react"
import { ModeToggle } from "./theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb"

export function Header({ hasClerk = false }: { hasClerk?: boolean }) {
  const pathname = usePathname()

  // Parse pathname into breadcrumb segments
  const segments = pathname.split("/").filter(Boolean)

  // Map segments to labels and icons (matching sidebar)
  const getBreadcrumbData = (segment: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      dashboard: LayoutDashboard,
      chat: MessageCircle,
      connect: Plug,
      settings: Settings,
      billing: CreditCard,
      team: Users,
      support: LifeBuoy,
      feedback: Send,
    }

    return {
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      icon: iconMap[segment],
    }
  }

  return (
    <div className="bg-sidebar text-sidebar-foreground sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-screen-2xl items-center px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="flex items-center gap-2">
                  <Telescope className="size-4" />
                  hubble
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((segment, index) => {
              const { label, icon: Icon } = getBreadcrumbData(segment)
              const href = `/${segments.slice(0, index + 1).join("/")}`
              const isLast = index === segments.length - 1

              return (
                <React.Fragment key={segment}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="flex items-center gap-2">
                        {Icon && <Icon className="size-4" />}
                        {label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href} className="flex items-center gap-2">
                          {Icon && <Icon className="size-4" />}
                          {label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          {hasClerk ? (
            <>
              {/* TODO: Add loading skeleton for Clerk UserButton
                  Context: Implement SSR-safe skeleton that shows while Clerk is initializing without causing hydration errors
                  labels: area/ui, feature/auth, type/enhancement
                  assignees: omzification
                  milestone: 0.0.1 */}
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
