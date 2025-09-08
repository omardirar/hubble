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
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Archive } from "lucide-react"
import { useHydrated } from "@/hooks/useHydrated"

export function ChatSidebar({
  onNewChat,
  onSelectChat,
  side = "right",
  refreshKey,
  activeId,
}: {
  onNewChat?: (id?: string) => void
  onSelectChat?: (id: string) => void
  side?: "left" | "right"
  refreshKey?: number
  activeId?: string | null
}) {
  const { sessions } = useChatList()
  const hydrated = useHydrated()

  const [serverConversations, setServerConversations] = React.useState<
    Array<{ id: string; title: string; updated_at?: string }>
  >([])

  React.useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      fetch("/api/chat/conversations")
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
          return r.json()
        })
        .then((rows) => {
          if (!alive) return
          setServerConversations(rows)
        })
        .catch((e) => {
          toast.error("Failed to load conversations")
          console.error(e)
        })
    }, 120)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [refreshKey])

  {
    /* TODO: Add a "More" button that loads older conversations on demand (no pagination today). */
  }
  const recents = serverConversations.length ? serverConversations : sessions

  async function handleNewChat() {
    // Draft mode: do not create a DB row yet; the first send will create it
    onNewChat?.()
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
                    <SidebarMenuButton asChild isActive={Boolean(activeId && s.id === activeId)}>
                      <button
                        className="flex w-full items-center justify-between"
                        onClick={() => onSelectChat?.(s.id)}
                      >
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
                        <DropdownMenuItem
                          onClick={async () => {
                            const name = window.prompt("Rename conversation", s.title)
                            if (!name || !name.trim()) return
                            try {
                              const r = await fetch(`/api/chat/conversations/${s.id}`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ title: name.trim() }),
                              })
                              if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
                              setServerConversations((prev) =>
                                prev.map((c) => (c.id === s.id ? { ...c, title: name.trim() } : c)),
                              )
                            } catch (e) {
                              toast.error("Failed to rename")
                              console.error(e)
                            }
                          }}
                        >
                          <Pencil className="mr-2 size-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              const r = await fetch(`/api/chat/conversations/${s.id}`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ archived: true }),
                              })
                              if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
                              setServerConversations((prev) => prev.filter((c) => c.id !== s.id))
                            } catch (e) {
                              toast.error("Failed to archive")
                              console.error(e)
                            }
                          }}
                        >
                          <Archive className="mr-2 size-4" /> Archive
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
