import { Redis as RestRedis } from "@upstash/redis"
import { getConnectEnv } from "@hubble/env"

let restClient: RestRedis | null = null

export function getRestRedis(): RestRedis {
  if (restClient) return restClient
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getConnectEnv()
  restClient = new RestRedis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
  return restClient
}

/**
 * Acquire a simple distributed lock using SET NX PX. Returns true if acquired.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const redis = getRestRedis()
  const res = await redis.set(key, "1", { nx: true, px: ttlMs })
  return res === "OK"
}

export async function releaseLock(key: string): Promise<void> {
  const redis = getRestRedis()
  try {
    await redis.del(key)
  } catch {
    // best effort
  }
}

export async function publishEvent(channel: string, payload: unknown): Promise<number> {
  const redis = getRestRedis()
  return redis.publish(channel, JSON.stringify(payload))
}

// Note: WebSocket subscribe intentionally removed to avoid bundling unsupported paths.
// SSE route polls the database for new events instead.
