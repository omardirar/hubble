export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init)
  if (!res.ok) {
    throw new Error(await res.text().catch(() => res.statusText))
  }
  return res
}
