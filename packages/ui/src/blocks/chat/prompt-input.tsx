"use client"

/**
 * Prompt Input Component
 * Styled to match AI SDK design patterns
 */

import { Send, StopCircle } from "lucide-react"
import { cn } from "@hubble/core"
import type { ComponentProps, HTMLAttributes, FormEvent, KeyboardEvent } from "react"
import { Button } from "../../ui/button"
import TextareaAutosize from "react-textarea-autosize"

export type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  input: string
  isLoading?: boolean
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}

export const PromptInput = ({
  className,
  input,
  isLoading,
  onInputChange,
  onSubmit,
  ...props
}: PromptInputProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        onSubmit(e as any)
      }
    }
  }

  return (
    <div className="border-t">
      <form onSubmit={onSubmit} className={cn("mx-auto max-w-4xl p-4", className)} {...props}>
        <div className="relative flex items-center overflow-hidden rounded-xl border bg-background shadow-sm">
          <TextareaAutosize
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="min-h-12 w-full resize-none bg-transparent px-2 py-3 pr-16 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
            disabled={isLoading}
            autoFocus
            minRows={1}
            maxRows={10}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="absolute bottom-2 right-2 h-8 w-8 rounded-lg cursor-pointer disabled:cursor-not-allowed"
            variant={isLoading ? "secondary" : "default"}
          >
            {isLoading ? <StopCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
