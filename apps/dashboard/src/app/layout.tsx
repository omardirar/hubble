/**
 * Root Layout Component
 *
 * This is the root layout component for the Hubble web application. It provides
 * the base HTML structure, font configuration, authentication setup, and global
 * styling for all pages in the application.
 *
 * Features:
 * - Google Fonts integration (Geist Sans & Mono)
 * - Clerk authentication provider setup
 * - Responsive design with full viewport height
 * - Graceful fallback when authentication is not configured
 * - Global CSS and styling setup
 */

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
// Using environment variables directly since Next.js handles them at build time

// Configure Geist Sans font for body text
const geistSans = Geist({
  variable: "--font-geist-sans", // CSS variable for font family
  subsets: ["latin"], // Latin character subset
})

// Configure Geist Mono font for code/monospace text
const geistMono = Geist_Mono({
  variable: "--font-geist-mono", // CSS variable for font family
  subsets: ["latin"], // Latin character subset
})

// Application metadata for SEO and browser display
export const metadata: Metadata = {
  title: "Hubble", // Application title
  description: "An AI-powered Marketing Assistant", // Application description
}

/**
 * Root Layout Component Implementation
 *
 * This component renders the base layout for all pages in the application.
 * It handles authentication setup, font configuration, and provides a
 * consistent structure for the entire application.
 *
 * @param children - Child components to render within the layout
 * @returns JSX element representing the root layout
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Get Clerk publishable key from environment variables
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

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

  // Render with Clerk authentication provider
  return (
    <ClerkProvider publishableKey={publishableKey} appearance={{ baseTheme: shadcn }}>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <div className="h-svh overflow-hidden">
            {/* Hidden header with authentication controls */}
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
