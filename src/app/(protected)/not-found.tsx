import Link from "next/link"

export default function NotFound() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-4">This protected page does not exist.</p>
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="underline">Back to dashboard</Link>
      </div>
    </div>
  )
}


