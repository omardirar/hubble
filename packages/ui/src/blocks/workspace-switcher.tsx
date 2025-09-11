"use client"

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui"
import { ChevronDown } from "lucide-react"

export function WorkspaceSwitcher({
  items = ["Personal", "Org"],
  onSelect,
}: {
  items?: string[]
  onSelect?: (name: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Workspace <ChevronDown className="ml-1 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((name) => (
          <DropdownMenuItem key={name} onClick={() => onSelect?.(name)}>
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
