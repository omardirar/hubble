"use client"

/**
 * Message Component
 * Styled to match assistant-ui message design
 */

import { cn } from "@hubble/core"
import * as React from "react"
import type { HTMLAttributes } from "react"
import { Response } from "./response"

type Role = "user" | "assistant" | "system"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: Role
  content?: string
}

export const Message = ({ className, from, content, children, ...props }: MessageProps) => {
  const hasContent = content !== undefined && content !== ""
  const hasChildren = React.Children.count(children) > 0

  if (from === "user") {
    return (
      <div className={cn("mb-4", className)} {...props}>
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground max-w-[80%] rounded-lg px-2 py-2">
            {hasContent ? <p className="whitespace-pre-wrap text-sm">{content}</p> : children}
          </div>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className={cn("mb-4", className)} {...props}>
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-lg px-4 py-2">
          {hasContent ? (
            <Response className="prose-sm">{content}</Response>
          ) : hasChildren ? (
            children
          ) : (
            <Response className="prose-sm">{""}</Response>
          )}
        </div>
      </div>
    </div>
  )
}
