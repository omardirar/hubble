import {
  getSecretValue,
  getSupabaseEnvFromSecrets,
  getAnthropicEnvFromSecrets,
  getClerkSecretFromSecrets,
  type SecretsStoreEnv,
} from "@hubble/env"
import { createServiceClientFromSecrets } from "@hubble/db"

export async function handleSecretsExample(
  request: Request,
  env: SecretsStoreEnv,
): Promise<Response> {
  try {
    // Example 1: Get individual secret values
    const clerkSecret = await getSecretValue(env, "CLERK_SECRET_KEY")
    const anthropicKey = await getSecretValue(env, "ANTHROPIC_API_KEY")

    // Example 2: Get Supabase configuration from secrets
    const supabaseEnv = await getSupabaseEnvFromSecrets(env)

    // Example 3: Get Anthropic configuration from secrets
    const anthropicEnv = await getAnthropicEnvFromSecrets(env)

    // Example 4: Get Clerk secret using convenience function
    const clerkSecretFromHelper = await getClerkSecretFromSecrets(env)

    // Example 5: Create Supabase client using secrets
    const supabase = await createServiceClientFromSecrets(env)

    // Example 6: Test database connection
    const { data, error } = await supabase.from("tenants").select("count").limit(1)

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`)
    }

    return Response.json({
      ok: true,
      message: "Secrets Store integration working correctly",
      examples: {
        individualSecrets: {
          clerkSecretLength: clerkSecret.length,
          anthropicKeyLength: anthropicKey.length,
        },
        supabaseConfig: {
          url: supabaseEnv.url,
          anonKeyLength: supabaseEnv.anonKey.length,
        },
        anthropicConfig: {
          model: anthropicEnv.model,
          apiKeyLength: anthropicEnv.apiKey.length,
        },
        clerkSecretFromHelper: {
          length: clerkSecretFromHelper.length,
        },
        databaseConnection: {
          success: true,
          recordCount: data?.length || 0,
        },
      },
    })
  } catch (error) {
    console.error("Secrets example error:", error)
    return Response.json(
      {
        ok: false,
        error: (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 },
    )
  }
}
