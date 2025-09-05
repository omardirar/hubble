"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import { Plus } from "lucide-react"
import { useChatList } from "@/hooks/useChatList"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash } from "lucide-react"
import { useHydrated } from "@/hooks/useHydrated"

export function ChatSidebar({
  onNewChat,
  side = "right",
}: {
  onNewChat?: (id: string) => void
  side?: "left" | "right"
}) {
  const { sessions, addSession, removeSession } = useChatList()
  const hydrated = useHydrated()

  const recents = sessions

  function handleNewChat() {
    const id = addSession("New Chat")
    onNewChat?.(id)
  }

  return (
    <Sidebar
      variant="inset"
      collapsible="none"
      side={side}
      className="h-[calc(100svh-var(--site-header-height))]"
    >
      <SidebarHeader>
        <Button onClick={handleNewChat}>
          <Plus className="size-4" /> New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {!hydrated ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex h-8 items-center gap-2 rounded-md px-2">
                      <div className="bg-accent size-4 rounded-md" />
                      <div className="bg-accent h-4 w-3/4 rounded-md" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : recents.length === 0 ? (
                <SidebarMenuItem>
                  <div className="text-muted-foreground px-2 py-1 text-xs">No chats yet</div>
                </SidebarMenuItem>
              ) : (
                recents.map((s) => (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton asChild>
                      <button className="flex w-full items-center justify-between">
                        <span className="truncate">{s.title}</span>
                      </button>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <SidebarMenuAction asChild showOnHover>
                        <DropdownMenuTrigger asChild>
                          <button aria-label="Chat actions">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                      </SidebarMenuAction>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onClick={() => removeSession(s.id)}>
                          <Trash className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
