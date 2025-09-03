import { z } from 'zod'

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  MCP_MOTHERDUCK_URL: z.string().url(),
  MCP_JWT_PRIVATE_KEY: z.string().min(1),
  MCP_JWT_ISSUER: z.string().min(1),
  MCP_JWT_AUDIENCE: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  LOG_LEVEL: z.string().default('info'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

const env = parsed.data

export const config = {
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  anthropicModel: env.ANTHROPIC_MODEL,
  mcpMotherduckUrl: env.MCP_MOTHERDUCK_URL,
  mcpJwtPrivateKey: env.MCP_JWT_PRIVATE_KEY,
  mcpJwtIssuer: env.MCP_JWT_ISSUER,
  mcpJwtAudience: env.MCP_JWT_AUDIENCE,
  logLevel: env.LOG_LEVEL,
}
