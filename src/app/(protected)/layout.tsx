import { SiteHeader } from "@/components/site-header"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }
  return (
    <>
      <SiteHeader />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-[calc(100svh-var(--site-header-height))] min-h-0">
          <div className="h-full min-h-0 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
