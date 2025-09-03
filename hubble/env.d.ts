declare namespace NodeJS {
  interface ProcessEnv {
    ANTHROPIC_API_KEY: string
    MCP_MOTHERDUCK_URL: string
    MCP_JWT_PRIVATE_KEY: string
    MCP_JWT_ISSUER: string
    MCP_JWT_AUDIENCE: string
    // Optional
    ANTHROPIC_MODEL?: string
    LOG_LEVEL?: string
  }
}


