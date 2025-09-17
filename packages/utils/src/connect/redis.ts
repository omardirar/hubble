import { Redis as RestRedis } from "@upstash/redis"
// Import with-websocket dynamically to avoid type complaints; local dev can skip
const WsRedis = ((): any => {
  try {
    const mod = require("@upstash/redis/with-websocket")
    return mod.Redis
  } catch {
    return null
  }
})()
import { getConnectEnv } from "@hubble/env"

let restClient: RestRedis | null = null
let wsClient: InstanceType<typeof WsRedis> | null = null

export function getRestRedis(): RestRedis {
  if (restClient) return restClient
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getConnectEnv()
  restClient = new RestRedis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
  return restClient
}

export function getWsRedis() {
  if (wsClient) return wsClient
  const { UPSTASH_REDIS_WS_URL, UPSTASH_REDIS_WS_TOKEN } = getConnectEnv()
  // Require WS config specifically for SSE subscriptions
  if (!UPSTASH_REDIS_WS_URL || !UPSTASH_REDIS_WS_TOKEN || !WsRedis) {
    throw new Error("Missing UPSTASH_REDIS_WS_URL/UPSTASH_REDIS_WS_TOKEN for pub/sub")
  }
  wsClient = new WsRedis({ url: UPSTASH_REDIS_WS_URL, token: UPSTASH_REDIS_WS_TOKEN })
  return wsClient
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

export async function subscribe(channel: string, onMessage: (json: string) => void) {
  const ws = getWsRedis()
  const sub = await ws.subscribe({
    channel,
    onMessage,
  })
  return sub
}
