/**
 * Example Secrets API Function for Vercel
 *
 * Demonstrates environment variable access in Vercel Functions
 * Converted from Cloudflare Secrets Store to Vercel environment variables
 */

import { VercelRequest, VercelResponse } from "@vercel/node"
import { createServiceClient } from "@hubble/db"

/**
 * Get environment variable configurations
 */
function getEnvironmentConfig() {
  const clerkSecret = process.env.CLERK_SECRET_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!clerkSecret) throw new Error("Missing CLERK_SECRET_KEY")
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY")
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL")
  if (!supabaseAnonKey) throw new Error("Missing SUPABASE_ANON_KEY")
  if (!supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")

  return {
    clerkSecret,
    anthropicKey,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Example 1: Get individual environment variables
    const config = getEnvironmentConfig()

    // Example 2: Create Supabase client using environment variables
    const supabase = createServiceClient()

    // Example 3: Test database connection
    const { data, error } = await supabase.from("tenants").select("count").limit(1)

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`)
    }

    return res.status(200).json({
      ok: true,
      message: "Environment variables integration working correctly",
      examples: {
        individualSecrets: {
          clerkSecretLength: config.clerkSecret.length,
          anthropicKeyLength: config.anthropicKey.length,
        },
        supabaseConfig: {
          url: config.supabaseUrl,
          anonKeyLength: config.supabaseAnonKey.length,
        },
        anthropicConfig: {
          model: config.anthropicModel,
          apiKeyLength: config.anthropicKey.length,
        },
        databaseConnection: {
          success: true,
          recordCount: data?.length || 0,
        },
      },
    })
  } catch (error) {
    console.error("Secrets example error:", error)
    return res.status(500).json({
      ok: false,
      error: (error as Error).message,
      stack: (error as Error).stack,
    })
  }
}
