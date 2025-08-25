"use client"

import { SignUp } from "@clerk/nextjs"

export default function Page() {
  return (
    <div className="flex h-[calc(100svh-var(--site-header-height))] items-center justify-center p-4">
      <SignUp />
    </div>
  )
}


