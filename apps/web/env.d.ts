declare namespace NodeJS {
  interface ProcessEnv {
    ANTHROPIC_API_KEY: string
    // Optional
    ANTHROPIC_MODEL?: string
    LOG_LEVEL?: string
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string
    CLERK_SECRET_KEY?: string
  }
}
