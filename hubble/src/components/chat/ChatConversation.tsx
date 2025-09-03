"use client"

import * as React from "react"
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Response } from "@/components/ai-elements/response"
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { isToolOrDynamicToolUIPart, getToolOrDynamicToolName } from "ai"
import type { UIMessage, ToolUIPart, DynamicToolUIPart } from "ai"

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
                  if (isToolOrDynamicToolUIPart(part)) {
                    const p = part as ToolUIPart | DynamicToolUIPart
                    const toolName = String(getToolOrDynamicToolName(p))
                    const output = p.state === "output-available"
                      ? (typeof p.output === "string"
                        ? p.output
                        : <pre className="p-3 whitespace-pre-wrap text-xs">{JSON.stringify(p.output, null, 2)}</pre>)
                      : undefined
                    const errorText = p.state === "output-error" ? p.errorText : undefined

                    return (
                      <Tool key={`${m.id}-tool-${p.toolCallId}`}>
                        <ToolHeader type={toolName} state={p.state} />
                        <ToolContent>
                          <ToolInput input={p.input} />
                          <ToolOutput output={output} errorText={errorText} />
                        </ToolContent>
                      </Tool>
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


