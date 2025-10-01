"use client"

/**
 * Conversation Component
 * Styled to match assistant-ui Thread design
 */

import { cn } from "@hubble/core"
import type { ComponentProps } from "react"
import { useCallback, useRef, useEffect, useState } from "react"
import { Button } from "../../ui/button"
import { ArrowDown } from "lucide-react"

export type ConversationProps = ComponentProps<"div"> & {
  welcome?: {
    message?: string
  }
}

export const Conversation = ({ className, children, welcome, ...props }: ConversationProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Track scroll position
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleScroll = () => {
      const isScrolledUp = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 100
      setShowScrollButton(isScrolledUp)
    }

    viewport.addEventListener("scroll", handleScroll)
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport && !showScrollButton) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [children, showScrollButton])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  return (
    <div className={cn("flex flex-1 flex-col min-h-0 relative", className)} {...props}>
      {/* Messages Viewport */}
      <div ref={viewportRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {!children ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {welcome?.message || "Hello! How can I help you today?"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {children}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <Button
        onClick={scrollToBottom}
        size="icon"
        variant="secondary"
        className={cn(
          "absolute bottom-5 right-4 rounded-full shadow-lg transition-all duration-300 cursor-pointer",
          showScrollButton
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0 pointer-events-none",
        )}
        aria-label="Scroll to bottom"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  )
}
