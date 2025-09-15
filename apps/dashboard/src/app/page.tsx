import Link from "next/link"
import { Button } from "@hubble/ui"
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"

export default function Home() {
  // Check if Clerk is configured
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  if (!hasClerk) {
    return (
      <div className="flex h-svh items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to Hubble</h1>
          <p className="text-muted-foreground">Authentication is not configured</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-svh items-center justify-center p-4">
      <SignedOut>
        <SignInButton>
          <Button>Sign in</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Link href="/chat">
          <Button>Open chat</Button>
        </Link>
      </SignedIn>
    </div>
  )
}
