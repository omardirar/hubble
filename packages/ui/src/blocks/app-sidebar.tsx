"use client"

import * as React from "react"
import {
  MessageCircle,
  LayoutDashboard,
  Send,
  Plug,
  Settings,
  CreditCard,
  Users,
  LifeBuoy,
} from "lucide-react"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { Sidebar, SidebarContent, SidebarRail } from "../ui"

const data = {
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Chat", url: "/chat", icon: MessageCircle },
    { title: "Connect", url: "/connect", icon: Plug },
  ],
  navSecondary: [
    { title: "Settings", url: "/settings", icon: Settings },
    { title: "Billing", url: "/billing", icon: CreditCard },
    { title: "Team", url: "/team", icon: Users },
    { title: "Support", url: "/support", icon: LifeBuoy },
    { title: "Feedback", url: "/feedback", icon: Send },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
