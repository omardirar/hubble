/**
 * Error Handling Utilities
 *
 * This module provides custom error classes and error handling utilities
 * for consistent error management across the Hubble application.
 */

/**
 * Custom application error class with optional error codes
 *
 * This class extends the native Error class to provide additional functionality
 * for application-specific error handling. It includes an optional error code
 * that can be used for programmatic error handling and user-friendly error messages.
 *
 * Features:
 * - Extends native Error class
 * - Optional error code for programmatic handling
 * - Consistent error naming
 * - Maintains stack trace
 *
 * @param message - Human-readable error message
 * @param code - Optional error code for programmatic handling
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string, // Optional error code for programmatic handling
  ) {
    super(message)
    this.name = "AppError" // Set the error name for identification
  }
}

// TODO: Add HTTP→AppError mapping helpers
//   Context: Provide utilities to convert fetch/Response errors to typed AppError instances for UI handling.
//   labels: area/utils, feature/errors, type/quality
//   assignees: omzification
//   milestone: 0.0.1
