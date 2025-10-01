/**
 * Assistant UI Runtime Adapter
 *
 * Integrates assistant-ui with AI SDK for chat functionality.
 */

import { useChat } from "@ai-sdk/react"
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk"

/**
 * Hook to create assistant-ui runtime from AI SDK useChat
 */
export function useAssistantRuntime(chat: ReturnType<typeof useChat>) {
  const runtime = useAISDKRuntime(chat)

  return runtime
}
