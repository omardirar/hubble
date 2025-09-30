"use client"

/**
 * React Query Provider
 *
 * Configures and provides the React Query client for data fetching and caching.
 *
 * Configuration:
 * - Default staleTime: 30 seconds (data is considered fresh for this duration)
 * - Default cacheTime: 5 minutes (unused data stays in cache)
 * - Retry: 2 attempts for failed queries
 * - RefetchOnWindowFocus: true (refetch when user returns to tab)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Consider data fresh for 30 seconds
            staleTime: 30 * 1000,
            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed queries twice
            retry: 2,
            // Refetch when user returns to the tab
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is still fresh
            refetchOnMount: false,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
