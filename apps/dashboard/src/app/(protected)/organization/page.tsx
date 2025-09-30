"use client"

/**
 * Organization Page
 *
 * Organization management interface using Clerk's OrganizationProfile component.
 * Provides functionality for managing organization settings, members, and roles.
 *
 * Features:
 * - Organization settings and details
 * - Member management and invitations
 * - Role and permission assignments
 * - Organization billing and usage
 * - Security and access controls
 */

import { OrganizationProfile } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

export default function OrganizationPage() {
  return (
    <div className="flex h-[calc(100svh-var(--site-header-height))] items-center justify-center p-4">
      <OrganizationProfile appearance={{ baseTheme: shadcn }} />
    </div>
  )
}
