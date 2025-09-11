import { SiteHeader, AppSidebar } from "@hubble/ui"
import { SidebarInset, SidebarProvider } from "@hubble/ui"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-[calc(100svh-var(--site-header-height))] min-h-0">
          <div className="h-full min-h-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
