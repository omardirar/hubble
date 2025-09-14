/**
 * Conversation by ID API Function for Vercel
 *
 * Handles updating specific conversations
 * Converted from Cloudflare Worker to Vercel Function
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import { createBrowserClient } from "@hubble/db"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid conversation ID" })
    }

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const token = authHeader.substring(7)
    const supabase = createBrowserClient({ authToken: token })

    if (req.method === "PATCH") {
      const body = req.body || {}
      const updates: Record<string, unknown> = {}

      if (typeof body.title === "string") updates.title = body.title
      if (typeof body.archived === "boolean")
        updates.archived_at = body.archived ? new Date().toISOString() : null

      const { data, error } = await supabase
        .from("conversations")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json(data)
    }

    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    console.error("Conversation by ID endpoint error:", error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
