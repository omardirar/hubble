"use client"

/**
 * Profile Page
 *
 * User profile management interface using Clerk's UserProfile component.
 * Provides functionality for managing personal account settings and preferences.
 *
 * Features:
 * - Personal information and contact details
 * - Account security and password management
 * - Email and phone number verification
 * - Connected accounts and social logins
 * - Privacy and data preferences
 */

import { UserProfile } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

export default function ProfilePage() {
  return (
    <div className="flex h-[calc(100svh-var(--site-header-height))] items-center justify-center p-4">
      <UserProfile appearance={{ baseTheme: shadcn }} />
    </div>
  )
}
