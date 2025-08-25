"use client"

import * as React from "react"
import TextareaAutosize from "react-textarea-autosize"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <TextareaAutosize
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message. Press Enter to send, Shift+Enter for a new line."
        className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-10 max-h-40"
        minRows={1}
        maxRows={8}
      />
      <Button type="submit" disabled={disabled}>
        <Send className="size-4" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  )
}


