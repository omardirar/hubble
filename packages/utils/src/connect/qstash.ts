import { getConnectEnv } from "@hubble/env"

/**
 * Enqueue a provisioning job using QStash REST API.
 * Avoids SDK to keep bundle minimal and skip type deps.
 */
export async function enqueueProvisionJob(
  baseUrl: string,
  body: { org_id: string; correlation_id: string },
) {
  const { QSTASH_TOKEN } = getConnectEnv()
  const target = new URL("/api/queues/provision", baseUrl).toString()
  const url = `https://qstash.upstash.io/v2/publish/${encodeURIComponent(target)}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Deduplication-Id": body.correlation_id,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`QStash publish failed: ${res.status}`)
  return res.json().catch(() => ({}))
}
