"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OrgSwitcher({
  items = ["Acme Inc", "Acme Corp", "Evil Corp"],
  href = "#",
}: {
  items?: string[]
  href?: string
}) {
  const [active, setActive] = React.useState(items[0] ?? "")

  return (
    <div className="flex items-center">
      <Link href={href} className="text-sm">
        {active}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {items.map((name) => (
            <DropdownMenuItem key={name} onClick={() => setActive(name)}>
              {name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
