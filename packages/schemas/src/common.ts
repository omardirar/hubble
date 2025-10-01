/**
 * Common Type Utilities
 *
 * Provides shared TypeScript utility types used across the Hubble application.
 */

// Common utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Database entity types
export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

export interface Tenant extends BaseEntity {
  org_id: string
  status: "active" | "inactive" | "suspended"
}

export interface Connection extends BaseEntity {
  tenant_id: string
  source_type: string
  status: "pending" | "active" | "error" | "disabled"
  fivetran_connector_id?: string
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    hasNext: boolean
    hasPrev: boolean
  }
}
