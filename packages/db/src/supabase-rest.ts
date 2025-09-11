type HeadersInput = HeadersInit | undefined

export type SupabaseRest = {
  request: (path: string, init?: RequestInit) => Promise<Response>
  get: (path: string, init?: RequestInit) => Promise<Response>
  post: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  patch: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  headers: (extra?: HeadersInput) => HeadersInit
}

export function createSupabaseRest(args: {
  url: string
  anonKey: string
  token: string
}): SupabaseRest {
  const base = args.url.replace(/\/+$/, "")

  // TODO: Add retry with exponential backoff for 5xx/429
  //   Context: Improve resilience to transient failures; respect Retry-After, jitter, and AbortSignal.
  //   labels: area/utils, feature/http, type/quality
  //   assignees: omzification
  //   milestone: 0.0.1

  function mergeHeaders(extra?: HeadersInput): HeadersInit {
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${args.token}`,
      apikey: args.anonKey,
      "content-type": "application/json",
      Prefer: "return=representation",
    }
    if (!extra) return baseHeaders

    // Merge any provided headers on top
    const result = new Headers(baseHeaders as HeadersInit)
    const provided = new Headers(extra as HeadersInit)
    provided.forEach((value, key) => result.set(key, value))
    return result
  }

  function buildUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`
  }

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const url = buildUrl(path)
    const headers = mergeHeaders(init?.headers)
    return fetch(url, { ...init, headers })
  }

  // TODO: Expose typed JSON parser helpers
  //   Context: Provide json<T>() wrapper that validates shapes and surfaces parsing errors clearly.
  //   labels: area/utils, feature/types, type/quality
  //   assignees: omzification
  //   milestone: 0.0.1

  const get = (path: string, init?: RequestInit) => request(path, { ...init, method: "GET" })
  const post = (path: string, body?: unknown, init?: RequestInit) =>
    request(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const patch = (path: string, body?: unknown, init?: RequestInit) =>
    request(path, {
      ...init,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  return { request, get, post, patch, headers: mergeHeaders }
}
