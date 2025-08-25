import { SiteHeader } from "@/components/site-header"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }
  return (
    <>
      <SiteHeader />
      <div className="h-[calc(100svh-var(--site-header-height))] overflow-hidden">
        {children}
      </div>
    </>
  )
}


