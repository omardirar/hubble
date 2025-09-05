"use client"

import * as React from "react"
import { useLocalStorage } from "usehooks-ts"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
}

export function useChatState(storageKey: string = "chat_messages") {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(storageKey, [
    {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      role: "assistant",
      content: "Hi! How can I help you today?",
      createdAt: Date.now(),
    },
  ])
  const [input, setInput] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)

  const submit = React.useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    const userMsg: ChatMessage = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
        role: "assistant",
        content: "This is a placeholder response. Wire me up to your backend or model API.",
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 800)
  }, [input, setMessages])

  const clear = React.useCallback(() => {
    setMessages([
      {
        id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
        role: "assistant",
        content: "Cleared. How can I help?",
        createdAt: Date.now(),
      },
    ])
  }, [setMessages])

  return { messages, setMessages, input, setInput, isTyping, submit, clear }
}
