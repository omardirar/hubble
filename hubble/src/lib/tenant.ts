export class AuthorizationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AuthorizationError"
    }
  }
  
  export class OrgMappingNotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "OrgMappingNotFoundError"
    }
  }
  
  /**
   * Resolves the authorized database name for a given Clerk orgId.
   * - For this deployment, the database name equals the Clerk orgId.
   * - Client hint is validated but never trusted.
   * - IMPORTANT: Do not prefix with "md:" here. Keep db names clean.
   */
  export async function resolveDbForOrg(
    orgId: string,
    clientHint?: string
  ): Promise<string> {
    const db = orgId // use the raw Clerk orgId as the db name
  
    if (clientHint && clientHint !== db) {
      throw new AuthorizationError(
        "Client-provided db hint does not match authorized database"
      )
    }
  
    return db
  }
  