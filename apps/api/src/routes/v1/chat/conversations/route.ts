import { createBrowserClientWithFallback } from "@hubble/db"
import { type SecretsStoreEnv } from "@hubble/env"
import { extractJWTClaims } from "@hubble/auth"
import {
  type ConversationSummary,
  type CreateConversationRequest,
  type CreateConversationResponse,
  validateCreateConversationRequest,
  validateConversationSummary,
} from "@hubble/api-contracts/chat"

export async function handleConversations(
  request: Request,
  env: SecretsStoreEnv,
): Promise<Response> {
  try {
    // Validate authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("Conversations request missing or invalid Authorization header")
      return Response.json({ error: "Unauthorized" }, { status: 401 })
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
      return Response.json({ error: "Invalid token" }, { status: 401 })
    }

    // Create Supabase client with JWT token
    const supabase = await createBrowserClientWithFallback(env, { authToken: token })

    if (request.method === "GET") {
      console.log("Fetching conversations", { userId, orgId })

      const { data, error } = await supabase
        .from("conversation_summaries")
        .select("id,title,updated_at,archived_at,last_message_text")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })

      if (error) {
        console.error("Database error fetching conversations:", error)
        return Response.json({ error: "Failed to fetch conversations" }, { status: 500 })
      }

      // Validate response data against schema
      try {
        const validatedData: ConversationSummary[] = (data || []).map(validateConversationSummary)
        console.log("Successfully fetched conversations", { count: validatedData.length })
        return Response.json(validatedData)
      } catch (validationError) {
        console.error("Data validation error:", validationError)
        return Response.json({ error: "Data validation failed" }, { status: 500 })
      }
    }

    if (request.method === "POST") {
      // Parse and validate request body
      let body: any
      try {
        body = await request.json()
      } catch (parseError) {
        console.warn("Invalid JSON in conversation creation request")
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
      }

      // Validate request body against schema
      let validatedBody: CreateConversationRequest
      try {
        validatedBody = validateCreateConversationRequest(body)
      } catch (validationError) {
        console.warn("Invalid conversation creation request:", validationError)
        return Response.json({ error: "Invalid request data" }, { status: 400 })
      }

      const title = validatedBody.title ?? "New Chat"
      console.log("Creating conversation", { userId, orgId, title })

      // Verify organization exists in Clerk mirror
      const { data: orgData, error: orgError } = await supabase.rpc("get_org_from_clerk_mirror", {
        p_org_id: orgId,
      })

      if (orgError || !orgData) {
        console.error("Organization not found in Clerk mirror:", orgError)
        return Response.json({ error: "Organization not found" }, { status: 404 })
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
        return Response.json({ error: "Failed to create conversation" }, { status: 500 })
      }

      // Validate response data against schema
      try {
        const validatedData: CreateConversationResponse = data
        console.log("Successfully created conversation", { id: validatedData.id })
        return Response.json(validatedData)
      } catch (validationError) {
        console.error("Response validation error:", validationError)
        return Response.json({ error: "Response validation failed" }, { status: 500 })
      }
    }

    console.warn("Unsupported method for conversations endpoint", { method: request.method })
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  } catch (error) {
    console.error("Conversations endpoint error:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
