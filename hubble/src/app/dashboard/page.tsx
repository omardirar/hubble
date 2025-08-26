import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Page() {
  return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset />
      </SidebarProvider>
  )
}
