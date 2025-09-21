import { randomUUID } from "node:crypto"

import { Redis } from "@upstash/redis"

import { getRedisConfig } from "@hubble/env"

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`

let restClient: Redis | null = null

export class RedisError extends Error {
  declare cause?: unknown

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = "RedisError"
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export class RedisUnavailableError extends RedisError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "RedisUnavailableError"
  }
}

export class RedisLockReleaseError extends RedisError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "RedisLockReleaseError"
  }
}

export class RedisLockRefreshError extends RedisError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "RedisLockRefreshError"
  }
}

export interface LockHandle {
  key: string
  token: string
  ttlMs: number
  acquiredAt: number
}

export function getRedisClient(): Redis {
  if (restClient) {
    return restClient
  }

  const { restUrl, restToken } = getRedisConfig()
  restClient = new Redis({ url: restUrl, token: restToken })
  return restClient
}

export async function acquireLock(key: string, ttlMs: number): Promise<LockHandle | null> {
  const client = getRedisClient()
  const token = randomUUID()

  try {
    const result = await client.set(key, token, { nx: true, px: ttlMs })
    if (result === "OK") {
      return {
        key,
        token,
        ttlMs,
        acquiredAt: Date.now(),
      }
    }
    return null
  } catch (error) {
    throw new RedisUnavailableError(`Failed to acquire Redis lock for ${key}`, { cause: error })
  }
}

export async function releaseLock(lock: LockHandle): Promise<boolean> {
  const client = getRedisClient()

  try {
    const released = await client.eval(RELEASE_SCRIPT, [lock.key], [lock.token])
    return Number(released) === 1
  } catch (error) {
    throw new RedisLockReleaseError(`Failed to release Redis lock for ${lock.key}`, {
      cause: error,
    })
  }
}

export async function refreshLock(lock: LockHandle, ttlMs: number): Promise<boolean> {
  const client = getRedisClient()

  try {
    const refreshed = await client.eval(EXTEND_SCRIPT, [lock.key], [lock.token, ttlMs.toString()])
    if (Number(refreshed) === 1) {
      lock.ttlMs = ttlMs
      lock.acquiredAt = Date.now()
      return true
    }
    return false
  } catch (error) {
    throw new RedisLockRefreshError(`Failed to refresh Redis lock for ${lock.key}`, {
      cause: error,
    })
  }
}

export async function publishEvent(channel: string, payload: unknown): Promise<number> {
  const client = getRedisClient()

  try {
    const message = JSON.stringify(payload)
    return await client.publish(channel, message)
  } catch (error) {
    throw new RedisUnavailableError(`Failed to publish payload to ${channel}`, { cause: error })
  }
}
