import Link from "next/link"
import { Button } from "@hubble/ui"
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
        <Link href="/chat">
          <Button>Open chat</Button>
        </Link>
      </SignedIn>
    </div>
  )
}
