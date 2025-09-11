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
import { readPublicEnv } from "@hubble/env"

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
  const { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey } = readPublicEnv()
  // TODO: Document header visibility and auth rendering; add ADR
  //   Context: Clarify header contract and auth rendering patterns; include decision record.
  //   labels: area/web, feature/docs, type/docs
  //   assignees: omzification
  //   milestone: 0.0.1
  // If no publishable key is provided (e.g., build/preview without env),
  // render without ClerkProvider to avoid crashing at build-time.
  if (!publishableKey) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <div className="h-svh overflow-hidden">{children}</div>
        </body>
      </html>
    )
  }

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
