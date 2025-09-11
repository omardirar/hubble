import { Button, ScrollArea, ScrollBar } from "../../ui"
import { cn } from "@hubble/utils"
import type * as React from "react"

export type SuggestionListProps = React.ComponentProps<typeof ScrollArea>
export const SuggestionList = ({ className, ...props }: SuggestionListProps) => (
  <ScrollArea className={cn("max-w-full", className)} {...props}>
    <div className="flex min-w-max items-center gap-2 p-2" />
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
)

export type SuggestionProps = React.ComponentProps<typeof Button>
export const Suggestion = ({ className, children, ...props }: SuggestionProps) => (
  <Button
    className={cn("rounded-full", className)}
    size="sm"
    type="button"
    variant="outline"
    {...props}
  >
    {children}
  </Button>
)
