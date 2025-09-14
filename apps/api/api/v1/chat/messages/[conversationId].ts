/**
 * Messages API Function for Vercel
 *
 * Handles listing and creating messages within conversations
 * Converted from Cloudflare Worker to Vercel Function
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import { createBrowserClient } from "@hubble/db"
import { extractJWTClaims } from "@hubble/auth"
import { contentToText } from "@hubble/utils"
import {
  type ApiMessage,
  type CreateMessageRequest,
  type CreateMessageResponse,
  validateCreateMessageRequest,
  validateApiMessage,
} from "@hubble/api-contracts/chat"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { conversationId } = req.query

    if (!conversationId || typeof conversationId !== "string") {
      return res.status(400).json({ error: "Invalid conversation ID" })
    }

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const token = authHeader.substring(7)

    // Extract user and organization information from JWT token
    const { userId, orgId } = extractJWTClaims(token)

    const supabase = createBrowserClient({ authToken: token })

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      const msgs: ApiMessage[] = (data || []).map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant" | "system",
        text: contentToText(r.content),
        created_at: r.created_at,
      }))

      // Validate response data against schema
      const validatedData = msgs.map(validateApiMessage)
      return res.status(200).json(validatedData)
    }

    if (req.method === "POST") {
      // Validate request body against schema
      const body = req.body || {}
      const validatedBody = validateCreateMessageRequest(body)
      const role = validatedBody.role ?? "user"
      const text = validatedBody.text ?? ""
      const idem = validatedBody.idempotencyKey ?? null

      const { data, error } = await supabase.rpc("rpc_append_message", {
        p_conversation_id: conversationId,
        p_role: role,
        p_content: { text },
        p_idempotency_key: idem,
      })

      if (error) {
        // Handle idempotency conflict by fetching the existing message
        if ((error.code === "23505" || error.message?.includes("idempotency")) && idem) {
          const { data: existingMessage, error: fetchError } = await supabase
            .from("messages")
            .select("id,role,content,created_at")
            .eq("conversation_id", conversationId)
            .eq("idempotency_key", idem)
            .single()

          if (fetchError) {
            return res.status(500).json({
              error: `Failed to fetch existing message: ${fetchError.message}`,
            })
          }

          return res.status(200).json({
            id: existingMessage.id,
            role: existingMessage.role,
            content: existingMessage.content,
            created_at: existingMessage.created_at,
          })
        }

        return res.status(500).json({ error: error.message })
      }

      // Validate response data against schema
      const validatedData: CreateMessageResponse = data
      return res.status(200).json(validatedData)
    }

    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    console.error("Messages endpoint error:", error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
