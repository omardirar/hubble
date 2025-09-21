"use client"

import { useLocalStorage } from "usehooks-ts"
import * as React from "react"
import { generateId } from "@hubble/utils"

export type ChatSession = {
  id: string
  title: string
  createdAt: number
}

export function useChatList(storageKey: string = "chat_sessions") {
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>(storageKey, [], {
    // Avoid SSR/CSR markup mismatch by not reading localStorage on first render
    initializeWithValue: false,
  })

  // TODO: Add session persistence and sync across tabs
  //   Context: Implement cross-tab synchronization for chat sessions using storage events.
  //   labels: area/ui, feature/chat, type/enhancement
  //   assignees: omzification
  //   milestone: 0.0.1

  const addSession = React.useCallback(
    (title: string) => {
      const id = generateId()
      const session: ChatSession = { id, title, createdAt: Date.now() }
      setSessions((prev) => [session, ...prev])
      return id
    },
    [setSessions],
  )

  const removeSession = React.useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
    },
    [setSessions],
  )

  return { sessions, addSession, removeSession }
}
