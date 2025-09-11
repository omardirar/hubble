"use client"

import * as React from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation"
import { Message, MessageContent } from "../ai-elements/message"
import { Response } from "../ai-elements/response"

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
