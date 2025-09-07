import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Hubble",
  description: "An AI-powered Marketing Assistant",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY
  if (!publishableKey) {
    try {
      // @ts-expect-error Cloudflare Workers virtual module available at runtime
      const mod = (await import("cloudflare:workers")) as { env?: Record<string, unknown> }
      const cfEnv = (mod?.env ?? undefined) as Record<string, unknown> | undefined
      const direct =
        (cfEnv?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined) ||
        (cfEnv?.CLERK_PUBLISHABLE_KEY as string | undefined)
      if (direct) publishableKey = direct
      else {
        const secretsUnknown = cfEnv?.SECRETS as unknown
        const hasGet =
          secretsUnknown !== null &&
          typeof secretsUnknown === "object" &&
          typeof (secretsUnknown as { get?: unknown }).get === "function"
        if (hasGet) {
          const store = secretsUnknown as { get: (name: string) => Promise<unknown> }
          const v = await store.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
          if (typeof v === "string" && v.length > 0) publishableKey = v
        }
      }
    } catch {
      // ignore if not on Workers
    }
  }
  // TODO: Document global header visibility and how auth renders; add ADR for layout decisions
  //  labels: docs, area:ui, P3
  //  assignees: me
  //  milestone: M2 - Refactors
  //  evidence: src/app/layout.tsx — implicit header contract
  return (
    <ClerkProvider publishableKey={publishableKey} appearance={{ baseTheme: shadcn }}>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <div className="h-svh overflow-hidden">
            <header className="hidden">
              <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}
