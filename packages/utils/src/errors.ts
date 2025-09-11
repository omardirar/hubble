export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "AppError"
  }
}

// TODO: Add HTTP→AppError mapping helpers
//   Context: Provide utilities to convert fetch/Response errors to typed AppError instances for UI handling.
//   labels: area/utils, feature/errors, type/quality
//   assignees: omzification
//   milestone: 0.0.1
