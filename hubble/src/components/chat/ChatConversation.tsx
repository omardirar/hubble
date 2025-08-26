"use client"

import * as React from "react"
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Response } from "@/components/ai-elements/response"
import type { UIMessage } from "ai"

export function ChatConversation({ messages, isTyping }: { messages: UIMessage[]; isTyping: boolean }) {
  return (
    <Conversation>
      <ConversationContent>
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => (
            <Message
              key={m.id}
              from={m.role}
              className={m.role === "assistant" ? "justify-start" : undefined}
            >
              <MessageContent
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <Response key={`${m.id}-${i}`}>{part.text}</Response>
                    )
                  }
                  return null
                })}
              </MessageContent>
            </Message>
          ))}

        {isTyping && (
          <Message from="assistant" className="justify-start">
            <MessageContent className="bg-secondary text-foreground">Typing…</MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}


