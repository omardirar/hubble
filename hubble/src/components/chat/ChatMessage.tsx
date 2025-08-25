"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Copy, Check } from "lucide-react"
import * as React from "react"
import copy from "copy-to-clipboard"
import { useHydrated } from "@/hooks/useHydrated"

export function ChatMessage({
  role,
  content,
}: {
  role: "user" | "assistant"
  content: string
}) {
  const hydrated = useHydrated()
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    try {
      copy(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  const isAssistant = role === "assistant"
  const containerClass = isAssistant
    ? "flex items-start gap-3"
    : "flex items-start gap-3 justify-end"
  const bubbleClass = isAssistant
    ? "bg-muted rounded-md px-3 py-2 max-w-[75%]"
    : "bg-primary text-primary-foreground rounded-md px-3 py-2 max-w-[75%]"

  if (!hydrated) {
    return (
      <div className={containerClass}>
        <div className={bubbleClass}>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      {role === "assistant" && (
        <Avatar className="size-7">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div className={bubbleClass}>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 w-6"
            aria-label="Copy message"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
      {role === "user" && (
        <Avatar className="size-7">
          <AvatarFallback>YOU</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}


