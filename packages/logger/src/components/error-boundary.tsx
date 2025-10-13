/**
 * Error Boundary with Logging
 *
 * React Error Boundary component that automatically logs errors
 * to the structured logging system.
 */

// TODO: Add toast notifications for error boundary errors
//   Context: Integrate Sonner toast to display user-friendly error messages when ErrorBoundary catches errors, with option to disable for embedded components.
//   labels: area/ui, feature/notifications, type/enhancement
//   assignees: omzification
//   milestone: 0.0.1

"use client"

import * as React from "react"
import { browserLoggers } from "../browser"

export interface ErrorBoundaryProps {
  /** Fallback UI to show when an error occurs */
  fallback?: React.ReactNode | ((error: Error, errorInfo: React.ErrorInfo) => React.ReactNode)
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Component name for logging context */
  componentName?: string
  /** Additional context to include in error logs */
  context?: Record<string, any>
  /** Children to render */
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary Component with automatic logging
 *
 * Catches React errors in component tree and logs them using the browser logger.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   componentName="ChatPanel"
 *   fallback={<ErrorFallback />}
 *   onError={(error) => toast.error("Something went wrong")}
 * >
 *   <ChatPanel />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state with error info
    this.setState({
      errorInfo,
    })

    // Log the error
    const logger = browserLoggers.ui(this.props.componentName || "ErrorBoundary")
    logger.error(
      "React error boundary caught error",
      {
        error: error.message,
        componentStack: errorInfo.componentStack,
        ...this.props.context,
      },
      error,
    )

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Render fallback UI
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.state.errorInfo!)
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred"}
          </p>
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook for logging errors in functional components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const logError = useErrorLogger("MyComponent")
 *
 *   useEffect(() => {
 *     try {
 *       // risky operation
 *     } catch (error) {
 *       logError(error as Error, { operation: "loadData" })
 *     }
 *   }, [])
 * }
 * ```
 */
export function useErrorLogger(componentName: string) {
  const logger = React.useMemo(() => browserLoggers.ui(componentName), [componentName])

  return React.useCallback(
    (error: Error, context?: Record<string, any>) => {
      logger.error("Component error", context || {}, error)
    },
    [logger],
  )
}

/**
 * Default error fallback component
 */
export function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-6">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        onClick={() => window.location.reload()}
      >
        Reload page
      </button>
    </div>
  )
}
