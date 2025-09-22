/**
 * Hubble Utils Package - Main Export
 *
 * This package provides shared utility functions used across the Hubble application.
 * It re-exports utilities from the specialized packages for backward compatibility.
 *
 * IMPORTANT: This package only exports client-safe utilities to avoid bundling
 * server-only code in client-side applications.
 */

// Re-export client-safe utilities only
export * from "@hubble/core"
export * from "@hubble/chat"
export * from "@hubble/types"
export * from "@hubble/logger"

// Re-export client-safe utilities for backward compatibility
export * from "./client"
export * from "./clerk-schema"

// Server-only modules are available under "@hubble/server"
// Connect utilities are available under "@hubble/connect"
// Note: Use @hubble/server for server-side utilities
// Note: Use @hubble/connect for connection-related utilities
