"use client"

import { UserProfile } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

export default function Page() {
  return (
    <div className="flex h-[calc(100svh-var(--site-header-height))] items-center justify-center p-4">
      <UserProfile appearance={{ baseTheme: shadcn }} />
    </div>
  )
}
