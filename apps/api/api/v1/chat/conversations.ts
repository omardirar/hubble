/**
 * Conversations API Function for Vercel
 *
 * Handles listing and creating chat conversations
 * Converted from Cloudflare Worker to Vercel Function
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import { createBrowserClient } from "@hubble/db"
import { extractJWTClaims } from "@hubble/auth"
import {
  type ConversationSummary,
  type CreateConversationRequest,
  type CreateConversationResponse,
  validateCreateConversationRequest,
  validateConversationSummary,
} from "@hubble/api-contracts/chat"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Validate authorization header
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("Conversations request missing or invalid Authorization header")
      return res.status(401).json({ error: "Unauthorized" })
    }

    const token = authHeader.substring(7)

    // Extract user and organization information from JWT token
    let userId: string
    let orgId: string
    try {
      const claims = extractJWTClaims(token)
      userId = claims.userId
      orgId = claims.orgId!
    } catch (jwtError) {
      console.error("JWT claims extraction failed:", jwtError)
      return res.status(401).json({ error: "Invalid token" })
    }

    // Create Supabase client with JWT token
    const supabase = createBrowserClient({ authToken: token })

    if (req.method === "GET") {
      console.log("Fetching conversations", { userId, orgId })

      const { data, error } = await supabase
        .from("conversation_summaries")
        .select("id,title,updated_at,archived_at,last_message_text")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })

      if (error) {
        console.error("Database error fetching conversations:", error)
        return res.status(500).json({ error: "Failed to fetch conversations" })
      }

      // Validate response data against schema
      try {
        const validatedData: ConversationSummary[] = (data || []).map(validateConversationSummary)
        console.log("Successfully fetched conversations", { count: validatedData.length })
        return res.status(200).json(validatedData)
      } catch (validationError) {
        console.error("Data validation error:", validationError)
        return res.status(500).json({ error: "Data validation failed" })
      }
    }

    if (req.method === "POST") {
      // Parse and validate request body
      const body = req.body || {}

      // Validate request body against schema
      let validatedBody: CreateConversationRequest
      try {
        validatedBody = validateCreateConversationRequest(body)
      } catch (validationError) {
        console.warn("Invalid conversation creation request:", validationError)
        return res.status(400).json({ error: "Invalid request data" })
      }

      const title = validatedBody.title ?? "New Chat"
      console.log("Creating conversation", { userId, orgId, title })

      // Verify organization exists in Clerk mirror
      const { data: orgData, error: orgError } = await supabase.rpc("get_org_from_clerk_mirror", {
        p_org_id: orgId,
      })

      if (orgError || !orgData) {
        console.error("Organization not found in Clerk mirror:", orgError)
        return res.status(404).json({ error: "Organization not found" })
      }

      // Insert conversation with user and organization information from JWT
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          title,
          owner_user_id: userId,
          org_id: orgId,
        })
        .select()
        .single()

      if (error) {
        console.error("Database error creating conversation:", error)
        return res.status(500).json({ error: "Failed to create conversation" })
      }

      // Validate response data against schema
      try {
        const validatedData: CreateConversationResponse = data
        console.log("Successfully created conversation", { id: validatedData.id })
        return res.status(200).json(validatedData)
      } catch (validationError) {
        console.error("Response validation error:", validationError)
        return res.status(500).json({ error: "Response validation failed" })
      }
    }

    console.warn("Unsupported method for conversations endpoint", { method: req.method })
    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    console.error("Conversations endpoint error:", error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
