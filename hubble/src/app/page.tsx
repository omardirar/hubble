import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"

export default function Home() {
  return (
    <div className="flex h-svh items-center justify-center p-4">
      <SignedOut>
        <SignInButton>
          <Button>Sign in</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button asChild>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </SignedIn>
    </div>
  )
}
