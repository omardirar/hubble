"use client"

import * as React from "react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../ui"
import { Plus, MoreHorizontal, Pencil, Archive } from "lucide-react"

export type ChatItem = { id: string; title: string; updated_at?: string }

export function ChatSidebar({
  items,
  isLoading = false,
  onNewChat,
  onSelectChat,
  onRename,
  onArchive,
  side = "right",
  activeId,
}: {
  items: ChatItem[]
  isLoading?: boolean
  onNewChat?: (id?: string) => void
  onSelectChat?: (id: string) => void
  onRename?: (id: string, newTitle: string) => Promise<void> | void
  onArchive?: (id: string) => Promise<void> | void
  side?: "left" | "right"
  activeId?: string | null
}) {
  return (
    <Sidebar
      variant="inset"
      collapsible="none"
      side={side}
      className="h-[calc(100svh-var(--site-header-height))]"
    >
      <SidebarHeader>
        <Button onClick={() => onNewChat?.()}>
          <Plus className="size-4" /> New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex h-8 items-center gap-2 rounded-md px-2">
                      <div className="bg-accent size-4 rounded-md" />
                      <div className="bg-accent h-4 w-3/4 rounded-md" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : items.length === 0 ? (
                <SidebarMenuItem>
                  <div className="text-muted-foreground px-2 py-1 text-xs">No chats yet</div>
                </SidebarMenuItem>
              ) : (
                items.map((s) => (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton asChild isActive={Boolean(activeId && s.id === activeId)}>
                      <button
                        className="flex w-full items-center justify-between"
                        onClick={() => onSelectChat?.(s.id)}
                      >
                        <span className="truncate">{s.title}</span>
                      </button>
                    </SidebarMenuButton>
                    {(onRename || onArchive) && (
                      <DropdownMenu>
                        <SidebarMenuAction asChild showOnHover>
                          <DropdownMenuTrigger asChild>
                            <button aria-label="Chat actions">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                        </SidebarMenuAction>
                        <DropdownMenuContent align="end">
                          {onRename && (
                            <DropdownMenuItem
                              onClick={async () => {
                                const name = window.prompt("Rename conversation", s.title)
                                if (!name || !name.trim()) return
                                await onRename(s.id, name.trim())
                              }}
                            >
                              <Pencil className="mr-2 size-4" /> Rename
                            </DropdownMenuItem>
                          )}
                          {onArchive && (
                            <DropdownMenuItem onClick={async () => onArchive(s.id)}>
                              <Archive className="mr-2 size-4" /> Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
