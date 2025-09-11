"use client"

import { Users } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui"

export function TeamSwitcher({ teams = ["Team A", "Team B"] }: { teams?: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <Users className="size-4" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Switch team
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {teams.map((name) => (
            <DropdownMenuItem key={name}>{name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
