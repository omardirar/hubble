/**
 * Caching utilities for API responses and metadata
 */

// Note: Logger import removed to avoid circular dependencies
// TODO: Add proper logging once logger package is properly configured

// Metrics collection is now integrated directly in core package

export interface CacheOptions {
  ttlMs: number
  maxSize?: number
  namespace?: string
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
}

export interface CacheEntry<T> {
  value: T
  timestamp: number
  hits: number
  lastAccessed: number
}

/**
 * In-memory cache with TTL and size limits
 */
export class MemoryCache<K extends string | number, V> {
  public cache = new Map<K, CacheEntry<V>>()
  public accessOrder: K[] = []

  get size(): number {
    return this.cache.size
  }

  get maxSize(): number {
    return this.options.maxSize || 1000
  }

  constructor(public options: CacheOptions) {
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), Math.min(options.ttlMs / 4, 60000))
  }

  async get(key: K): Promise<V | null> {
    const startTime = Date.now()
    const entry = this.cache.get(key)

    if (!entry) {
      const duration = Date.now() - startTime
      // TODO: Add metrics collection once metrics system is properly integrated
      // console.debug("cache.miss", { key, namespace: this.options.namespace })
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter((k) => k !== key)

      const duration = Date.now() - startTime
      // TODO: Add metrics collection once metrics system is properly integrated
      // console.debug("cache.expired", { key, namespace: this.options.namespace, age_ms: now - entry.timestamp, ttl_ms: this.options.ttlMs })
      return null
    }

    // Update access tracking
    entry.hits++
    entry.lastAccessed = now

    // Move to end of access order (LRU)
    this.accessOrder = this.accessOrder.filter((k) => k !== key)
    this.accessOrder.push(key)

    const duration = Date.now() - startTime
    // TODO: Add metrics collection once metrics system is properly integrated
    // console.debug("cache.hit", { key, namespace: this.options.namespace, hits: entry.hits, age_ms: now - entry.timestamp })

    return entry.value
  }

  async set(key: K, value: V): Promise<void> {
    const startTime = Date.now()
    const now = Date.now()

    // Evict if at max size (LRU eviction)
    if (this.cache.size >= (this.options.maxSize || 1000)) {
      this.evictLRU()
    }

    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      hits: 0,
      lastAccessed: now,
    }

    this.cache.set(key, entry)

    // Add to access order
    this.accessOrder.push(key)

    const duration = Date.now() - startTime
    // TODO: Add metrics collection once metrics system is properly integrated
    // console.debug("cache.set", { key, namespace: this.options.namespace, size: this.cache.size, max_size: this.options.maxSize })
  }

  async delete(key: K): Promise<boolean> {
    const startTime = Date.now()
    const deleted = this.cache.delete(key)
    this.accessOrder = this.accessOrder.filter((k) => k !== key)

    if (deleted) {
      const duration = Date.now() - startTime
      // TODO: Add metrics collection once metrics system is properly integrated
      // console.debug("cache.delete", { key, namespace: this.options.namespace })
    }

    return deleted
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []

    // console.info("cache.cleared", { namespace: this.options.namespace })
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    const oldestKey = this.accessOrder.shift()!
    this.cache.delete(oldestKey)

    // TODO: Add metrics collection once metrics system is properly integrated
    // console.debug("cache.evicted_lru", { key: oldestKey, namespace: this.options.namespace, remaining_size: this.cache.size })
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: K[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttlMs) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter((k) => k !== key)
    }

    if (expiredKeys.length > 0) {
      // console.debug("cache.cleanup", { expired_count: expiredKeys.length, namespace: this.options.namespace, remaining_size: this.cache.size })
    }
  }

  getStats() {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    const avgAge =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length
        : 0

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize || 1000,
      utilizationPercent: (this.cache.size / (this.options.maxSize || 1000)) * 100,
      totalHits,
      averageHits: entries.length > 0 ? totalHits / entries.length : 0,
      averageAgeMs: avgAge,
      oldestEntryAgeMs:
        entries.length > 0 ? Math.max(...entries.map((entry) => Date.now() - entry.timestamp)) : 0,
    }
  }
}

/**
 * JSON-based persistent cache (for server-side caching)
 */
export class PersistentCache<K extends string | number, V> {
  private cache: MemoryCache<K, V>
  private filePath?: string

  constructor(options: CacheOptions & { filePath?: string }) {
    this.cache = new MemoryCache(options)
    this.filePath = options.filePath

    if (this.filePath) {
      // Load from disk on startup
      this.loadFromDisk().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        // console.warn("cache.load_from_disk_failed", { error: errorMessage, filePath: this.filePath })
      })
    }
  }

  async get(key: K): Promise<V | null> {
    return this.cache.get(key)
  }

  async set(key: K, value: V): Promise<void> {
    await this.cache.set(key, value)

    // Persist to disk if configured
    if (this.filePath) {
      this.saveToDisk().catch((error) => {
        // console.error("cache.save_to_disk_failed", { error: error.message, filePath: this.filePath })
      })
    }
  }

  async delete(key: K): Promise<boolean> {
    const result = await this.cache.delete(key)

    if (result && this.filePath) {
      this.saveToDisk().catch((error) => {
        // console.error("cache.save_to_disk_after_delete_failed", { error: error.message, filePath: this.filePath })
      })
    }

    return result
  }

  async clear(): Promise<void> {
    await this.cache.clear()

    if (this.filePath) {
      this.saveToDisk().catch((error) => {
        // console.error("cache.save_to_disk_after_clear_failed", { error: error.message, filePath: this.filePath })
      })
    }
  }

  getStats() {
    return this.cache.getStats()
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.filePath) return

    try {
      const fs = await import("fs/promises")
      const data = await fs.readFile(this.filePath, "utf-8")
      const parsed = JSON.parse(data)

      for (const [key, entry] of Object.entries(parsed)) {
        if (Date.now() - (entry as CacheEntry<V>).timestamp < this.cache.options.ttlMs) {
          this.cache.cache.set(key as K, entry as CacheEntry<V>)
          this.cache.accessOrder.push(key as K)
        }
      }

      // console.info("cache.loaded_from_disk", { filePath: this.filePath, entries_loaded: Object.keys(parsed).length, current_size: this.cache.size })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if ((error as any).code !== "ENOENT") {
        // console.error("cache.load_from_disk_error", { error: errorMessage, filePath: this.filePath })
      }
    }
  }

  private async saveToDisk(): Promise<void> {
    if (!this.filePath) return

    try {
      const fs = await import("fs/promises")
      const data = Object.fromEntries(this.cache.cache.entries())
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))

      // console.debug("cache.saved_to_disk", { filePath: this.filePath, entries_saved: Object.keys(data).length })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // console.error("cache.save_to_disk_error", { error: errorMessage, filePath: this.filePath })
    }
  }
}

/**
 * Cached API response wrapper
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  cache: MemoryCache<string, T>,
  options?: {
    skipCache?: boolean
    forceRefresh?: boolean
  },
): Promise<T> {
  const { skipCache = false, forceRefresh = false } = options || {}

  if (skipCache || forceRefresh) {
    const result = await fn()
    await cache.set(key, result)
    return result
  }

  const cached = await cache.get(key)
  if (cached !== null) {
    return cached
  }

  const result = await fn()
  await cache.set(key, result)
  return result
}

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  fivetranGroups: () => "fivetran:groups",
  fivetranGroup: (groupId: string) => `fivetran:group:${groupId}`,
  fivetranDestinations: (groupId: string) => `fivetran:destinations:${groupId}`,
  fivetranDestination: (destinationId: string) => `fivetran:destination:${destinationId}`,
  fivetranConnectors: (groupId: string) => `fivetran:connectors:${groupId}`,
  fivetranConnector: (connectorId: string) => `fivetran:connector:${connectorId}`,

  motherduckServiceAccount: (username: string) => `motherduck:service_account:${username}`,
  motherduckToken: (username: string) => `motherduck:token:${username}`,
  motherduckDatabase: (dbName: string) => `motherduck:database:${dbName}`,

  provisionStatus: (orgId: string, correlationId: string) =>
    `provision:status:${orgId}:${correlationId}`,
  provisionEvents: (orgId: string, correlationId: string) =>
    `provision:events:${orgId}:${correlationId}`,
}

/**
 * Cache manager for different data types
 */
export class CacheManager {
  private caches = new Map<string, MemoryCache<any, any>>()

  createCache<K extends string | number, V>(
    name: string,
    options: CacheOptions,
  ): MemoryCache<K, V> {
    if (this.caches.has(name)) {
      throw new Error(`Cache '${name}' already exists`)
    }

    const cache = new MemoryCache<K, V>(options)
    this.caches.set(name, cache)
    return cache
  }

  getCache<K extends string | number, V>(name: string): MemoryCache<K, V> | null {
    return (this.caches.get(name) as MemoryCache<K, V>) || null
  }

  clearCache(name: string): boolean {
    const cache = this.caches.get(name)
    if (cache) {
      cache.clear()
      return true
    }
    return false
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
  }

  getStats() {
    const stats = Object.fromEntries(
      Array.from(this.caches.entries()).map(([name, cache]) => [name, cache.getStats()]),
    )

    const totalSize = Object.values(stats).reduce((sum, stat) => sum + (stat as any).size, 0)
    const totalMaxSize = Object.values(stats).reduce((sum, stat) => sum + (stat as any).maxSize, 0)

    return {
      caches: stats,
      totalSize,
      totalMaxSize,
      totalUtilizationPercent: totalMaxSize > 0 ? (totalSize / totalMaxSize) * 100 : 0,
    }
  }
}

// Global cache manager instance
export const globalCacheManager = new CacheManager()

/**
 * Cache decorators for methods
 */
export function cached(
  cacheKey: string | ((...args: any[]) => string),
  ttlMs: number = 300000, // 5 minutes default
  options?: {
    cache?: MemoryCache<string, any>
    skipCache?: (...args: any[]) => boolean
  },
) {
  const cacheName = typeof cacheKey === "string" ? cacheKey : "default"
  const cache =
    options?.cache ||
    globalCacheManager.createCache(cacheName, {
      ttlMs,
      maxSize: 1000,
      namespace: cacheName,
    })

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const key =
        typeof cacheKey === "function" ? cacheKey(...args) : `${cacheKey}:${args.join(":")}`

      if (options?.skipCache?.(...args)) {
        return originalMethod.apply(this, args)
      }

      const cachedResult = await cache.get(key)
      if (cachedResult !== null) {
        return cachedResult
      }

      const result = await originalMethod.apply(this, args)
      await cache.set(key, result)
      return result
    }

    return descriptor
  }
}

/**
 * Conditional cache decorator
 */
export function conditionalCache(
  condition: (...args: any[]) => boolean,
  cacheKey: string | ((...args: any[]) => string),
  ttlMs: number = 300000,
) {
  return cached(cacheKey, ttlMs, {
    skipCache: (...args) => !condition(...args),
  })
}

/**
 * Cache warming utility
 */
export class CacheWarmer {
  private warming = false

  constructor(
    private cache: MemoryCache<string, any>,
    private warmers: Array<{
      key: string
      fetcher: () => Promise<any>
    }>,
  ) {}

  async warm(): Promise<void> {
    if (this.warming) {
      // console.debug("cache_warmer.already_warming")
      return
    }

    this.warming = true

    try {
      // console.info("cache_warmer.starting", { warmer_count: this.warmers.length })

      const promises = this.warmers.map(async ({ key, fetcher }) => {
        try {
          const value = await fetcher()
          await this.cache.set(key, value)

          // console.debug("cache_warmer.warmed", { key })
          return { key, success: true }
        } catch (error) {
          // console.error("cache_warmer.warm_failed", { key, error: error instanceof Error ? error.message : String(error) })
          return {
            key,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })

      const results = await Promise.allSettled(promises)
      const successful = results.filter(
        (r) => r.status === "fulfilled" && (r.value as any).success,
      ).length
      const failed = results.length - successful

      // console.info("cache_warmer.completed", { total: results.length, successful, failed })
    } finally {
      this.warming = false
    }
  }

  isWarming(): boolean {
    return this.warming
  }
}
