export async function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // TODO(omzification | !area/utils | !feature/errors | !type/quality | error-shape): Normalize error response shape
    //   Context: Parse JSON error bodies to a consistent { code, message } shape; integrate with AppError.
    //   labels: area/utils, feature/errors, type/quality
    //   assignees: omzification
    //   milestone: 0.0.1
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res
}

// Alias commonly used in apps for clarity
export const apiFetch = safeFetch
