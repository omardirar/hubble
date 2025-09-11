import { SiteHeader, AppSidebar } from "@hubble/ui"
import { SidebarInset, SidebarProvider } from "@hubble/ui"
import { readPublicEnv } from "@hubble/env"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY } = readPublicEnv()
  const hasClerk = Boolean(NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  return (
    <>
      <SiteHeader hasClerk={hasClerk} />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-[calc(100svh-var(--site-header-height))] min-h-0">
          <div className="h-full min-h-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
