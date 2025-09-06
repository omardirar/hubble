"use client"

import * as React from "react"

export function ChatConversation({
  messages,
  isTyping,
}: {
  messages: Array<{ id: string; role: "user" | "assistant"; text: string }>
  isTyping: boolean
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === "user"
              ? "bg-primary text-primary-foreground max-w-[80%] self-end rounded-md px-3 py-2"
              : "bg-secondary text-foreground max-w-[80%] self-start rounded-md px-3 py-2"
          }
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {isTyping && (
        <div className="bg-secondary text-foreground max-w-[80%] self-start rounded-md px-3 py-2">
          <p className="text-sm">Typing…</p>
        </div>
      )}
    </div>
  )
}
