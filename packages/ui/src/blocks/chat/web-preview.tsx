"use client"

import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui"
import { cn } from "@hubble/core"
import { GlobeIcon, XIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes } from "react"

export type WebPreviewProps = HTMLAttributes<HTMLDivElement>
export const WebPreview = ({ className, ...props }: WebPreviewProps) => (
  <div className={cn("rounded-md border", className)} {...props} />
)

export type WebPreviewToolbarProps = HTMLAttributes<HTMLDivElement>
export const WebPreviewToolbar = ({ className, ...props }: WebPreviewToolbarProps) => (
  <div className={cn("flex items-center gap-2 border-b p-2", className)} {...props} />
)

export type WebPreviewUrlProps = ComponentProps<typeof Input>
export const WebPreviewUrl = ({ className, ...props }: WebPreviewUrlProps) => (
  <Input className={cn("h-8", className)} placeholder="https://example.com" {...props} />
)

export type WebPreviewContentProps = HTMLAttributes<HTMLDivElement>
export const WebPreviewContent = ({ className, ...props }: WebPreviewContentProps) => (
  <div className={cn("p-3", className)} {...props} />
)

export function WebPreviewHelp() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" type="button" aria-label="Help">
            <GlobeIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Paste a URL to preview content</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function WebPreviewDismiss(props: ComponentProps<typeof Button>) {
  return (
    <Button size="icon" variant="ghost" type="button" aria-label="Dismiss" {...props}>
      <XIcon className="size-4" />
    </Button>
  )
}
