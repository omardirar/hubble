"use client"

import * as React from "react"
import { MoreVertical, Archive, Plus } from "lucide-react"
import { cn } from "../../utils/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu"

export interface ThreadListItem {
  id: string
  title: string
  isActive?: boolean
}

export interface ThreadListProps {
  className?: string
  items?: ThreadListItem[]
  activeId?: string | null
  onNewThread?: () => void
  onSelectThread?: (id: string) => void
  onArchiveThread?: (id: string) => void
}

export function ThreadList({
  className,
  items = [],
  activeId,
  onNewThread,
  onSelectThread,
  onArchiveThread,
}: ThreadListProps) {
  return (
    <div className={cn("flex h-full w-64 flex-col min-h-0 border-r bg-background", className)}>
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button
          onClick={onNewThread}
          className="text-primary hover:text-primary/80 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1 p-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer",
                activeId === item.id && "bg-accent",
              )}
            >
              <button
                onClick={() => onSelectThread?.(item.id)}
                className="flex-1 truncate text-left cursor-pointer"
              >
                {item.title}
              </button>

              {onArchiveThread && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onArchiveThread(item.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ThreadList.displayName = "ThreadList"
