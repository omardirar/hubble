import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex h-[calc(100svh-var(--site-header-height))] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mb-4">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link href="/" className="underline">
            Go home
          </Link>
          <span className="text-muted-foreground">or</span>
          <Link href="/dashboard" className="underline">
            open dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
