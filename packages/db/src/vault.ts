/**
 * Vault Provider System
 *
 * This module provides a flexible vault system for secret management across
 * different environments. It supports multiple backends including Cloudflare
 * Workers environment bindings and Supabase database functions.
 *
 * Architecture:
 * - VaultProvider interface for pluggable backends
 * - CloudflareVaultProvider for Workers environment
 * - SupabaseVaultProvider for database-based secrets
 * - DefaultVaultProvider with fallback logic
 * - Global instance management
 */

import { createServiceClient } from "./server"

/**
 * Vault provider interface for secret retrieval
 *
 * This interface defines the contract for vault providers that can
 * retrieve secrets from various backends. All vault providers must
 * implement this interface to ensure consistent behavior.
 */
export interface VaultProvider {
  /**
   * Retrieve a secret by key
   * @param key - The secret key to retrieve
   * @returns Promise that resolves to the secret value or null if not found
   */
  getSecret(key: string): Promise<string | null>

  /**
   * Check if the vault provider is available
   * @returns True if the provider is available, false otherwise
   */
  isAvailable(): boolean
}

/**
 * Cloudflare Workers vault provider using environment bindings
 */
export class CloudflareVaultProvider implements VaultProvider {
  constructor(private env: any) {}

  isAvailable(): boolean {
    return typeof this.env !== "undefined" && this.env !== null
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      // Cloudflare Workers environment bindings for secrets
      const secret = this.env[key]
      return secret || null
    } catch (error) {
      console.warn(`Failed to retrieve secret ${key} from Cloudflare vault:`, error)
      return null
    }
  }
}

/**
 * Supabase Vault provider using database functions
 */
export class SupabaseVaultProvider implements VaultProvider {
  private supabase: any = null

  constructor(supabase?: any) {
    this.supabase = supabase
  }

  isAvailable(): boolean {
    return this.supabase !== null
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      // Use the vault_get_secret function from the database schema
      const { data, error } = await this.supabase.rpc("vault_get_secret", {
        p_name: key,
      })

      if (error) {
        console.warn(`Failed to retrieve secret ${key} from Supabase vault:`, error)
        return null
      }

      return data || null
    } catch (error) {
      console.warn(`Failed to retrieve secret ${key} from Supabase vault:`, error)
      return null
    }
  }
}

/**
 * Default vault provider that tries Cloudflare first, then Supabase
 */
export class DefaultVaultProvider implements VaultProvider {
  private cloudflareProvider: CloudflareVaultProvider
  private supabaseProvider: SupabaseVaultProvider

  constructor(env?: any, supabase?: any) {
    this.cloudflareProvider = new CloudflareVaultProvider(env)
    this.supabaseProvider = new SupabaseVaultProvider(supabase)
  }

  isAvailable(): boolean {
    return this.cloudflareProvider.isAvailable() || this.supabaseProvider.isAvailable()
  }

  async getSecret(key: string): Promise<string | null> {
    // Try Cloudflare first (faster for Workers)
    if (this.cloudflareProvider.isAvailable()) {
      const secret = await this.cloudflareProvider.getSecret(key)
      if (secret) {
        return secret
      }
    }

    // Fallback to Supabase Vault
    if (this.supabaseProvider.isAvailable()) {
      return await this.supabaseProvider.getSecret(key)
    }

    return null
  }
}

// Global vault provider instance
let vaultProvider: VaultProvider | null = null

/**
 * Initialize the vault provider with the appropriate backend
 * @param env Cloudflare Workers environment (optional)
 * @param supabase Supabase client instance (optional)
 */
export function initializeVault(env?: any, supabase?: any): void {
  vaultProvider = new DefaultVaultProvider(env, supabase)
}

/**
 * Get a secret from the configured vault provider
 * @param key The secret key to retrieve
 * @returns The secret value or null if not found
 */
export async function getSecret(key: string): Promise<string | null> {
  if (!vaultProvider) {
    // Auto-initialize with service client if available
    try {
      const supabase = createServiceClient()
      vaultProvider = new DefaultVaultProvider(undefined, supabase)
    } catch (error) {
      console.warn("Failed to auto-initialize vault provider:", error)
      return null
    }
  }

  if (!vaultProvider.isAvailable()) {
    console.warn("No vault provider is available")
    return null
  }

  return await vaultProvider.getSecret(key)
}

/**
 * Check if vault is available and properly configured
 * @returns True if vault is available, false otherwise
 */
export function isVaultAvailable(): boolean {
  if (!vaultProvider) {
    try {
      const supabase = createServiceClient()
      vaultProvider = new DefaultVaultProvider(undefined, supabase)
    } catch {
      return false
    }
  }
  return vaultProvider.isAvailable()
}
