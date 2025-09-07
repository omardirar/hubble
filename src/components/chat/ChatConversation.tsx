"use client"

import * as React from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Response } from "@/components/ai-elements/response"

export function ChatConversation({
  messages,
  isTyping,
}: {
  messages: Array<{ id: string; role: "user" | "assistant"; text: string }>
  isTyping: boolean
}) {
  return (
    <Conversation>
      <ConversationContent>
        {
          // TODO: Add a "Load older messages" button that prepends older results later.
        }
        {messages.map((m) => (
          <Message from={m.role} key={m.id}>
            <MessageContent>
              <Response>{m.text}</Response>
            </MessageContent>
          </Message>
        ))}
        {isTyping && (
          <Message from="assistant">
            <MessageContent>
              <p className="text-sm">Typing…</p>
            </MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton aria-label="Scroll to bottom" />
    </Conversation>
  )
}
