/**
 * Retry utilities with exponential backoff for handling transient failures
 */

// Note: Logger import removed to avoid circular dependencies
// TODO: Add proper logging once logger package is properly configured

// Metrics collection is now integrated directly in core package

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  jitterMs?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

export interface RetryResult<T> {
  result: T
  attempts: number
  totalDuration: number
}

/**
 * Determines if an error is retryable based on common patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return true
    }

    // HTTP errors that are typically transient
    if (
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("504") ||
      error.message.includes("429")
    ) {
      // Rate limited
      return true
    }

    // Temporary server errors
    if (
      error.message.includes("Internal Server Error") ||
      error.message.includes("Service Unavailable")
    ) {
      return true
    }
  }

  return false
}

/**
 * Executes a function with retry logic and exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitterMs = 100,
    shouldRetry = isRetryableError,
    onRetry,
  } = options

  const startTime = Date.now()
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now()

    try {
      const result = await fn()
      const attemptDuration = Date.now() - attemptStart
      const totalDuration = Date.now() - startTime

      // TODO: Add metrics collection once metrics system is properly integrated

      if (attempt > 0) {
        // console.info("retry.succeeded_after_retries", { attempts: attempt + 1, total_duration_ms: totalDuration, max_retries: maxRetries })
      }

      return {
        result,
        attempts: attempt + 1,
        totalDuration,
      }
    } catch (error) {
      const attemptDuration = Date.now() - attemptStart
      lastError = error

      // TODO: Add metrics collection once metrics system is properly integrated

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        const totalDuration = Date.now() - startTime
        // console.error("retry.exhausted_all_retries", { attempts: attempt + 1, total_duration_ms: totalDuration, max_retries: maxRetries, final_error: error instanceof Error ? error.message : String(error) })
        throw error
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt)
      const jitter = Math.random() * jitterMs
      const delayMs = Math.min(exponentialDelay + jitter, maxDelayMs)

      // console.warn("retry.attempt_failed", { attempt: attempt + 1, max_retries: maxRetries, delay_ms: delayMs, error: error instanceof Error ? error.message : String(error) })

      if (onRetry) {
        onRetry(error, attempt, delayMs)
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

/**
 * Simplified retry wrapper for common use cases
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const result = await retryWithBackoff(fn, { maxRetries })
  return result.result
}

/**
 * Retry with circuit breaker pattern for external services
 */
export class CircuitBreakerRetry {
  private failureCount = 0
  private lastFailureTime = 0
  private state: "closed" | "open" | "half-open" = "closed"

  constructor(
    private failureThreshold = 5,
    private timeoutMs = 60000,
    private successThreshold = 3,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = "half-open"
        // console.info("circuit_breaker.half_open")
      } else {
        throw new Error("Circuit breaker is open")
      }
    }

    try {
      const result = await fn()

      if (this.state === "half-open") {
        this.failureCount = 0
        this.state = "closed"
        // console.info("circuit_breaker.closed_after_recovery")
        // TODO: Add metrics collection once metrics system is properly integrated
      }

      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.failureThreshold) {
        this.state = "open"
        // console.error("circuit_breaker.opened", { failure_count: this.failureCount, threshold: this.failureThreshold })
      }

      // TODO: Add metrics collection once metrics system is properly integrated
      throw error
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: number[] = []

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now()

    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.windowMs)

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.windowMs - (now - oldestRequest)

      // console.info("rate_limiter.throttling", { wait_ms: waitTime, current_requests: this.requests.length, max_requests: this.maxRequests })

      // TODO: Add metrics collection once metrics system is properly integrated

      await new Promise((resolve) => setTimeout(resolve, waitTime))
      return this.acquire() // Retry after waiting
    }

    this.requests.push(now)
    // TODO: Add metrics collection once metrics system is properly integrated
  }

  getStats() {
    const now = Date.now()
    const recentRequests = this.requests.filter((time) => now - time < this.windowMs)

    return {
      currentRequests: recentRequests.length,
      maxRequests: this.maxRequests,
      utilizationPercent: (recentRequests.length / this.maxRequests) * 100,
    }
  }
}

/**
 * Batch API calls to reduce round trips
 */
export class BatchProcessor<T, R> {
  private batch: T[] = []
  private processing = false

  constructor(
    private batchSize: number,
    private maxWaitMs: number,
    private processor: (items: T[]) => Promise<R[]>,
    private flushInterval?: NodeJS.Timeout,
  ) {
    if (flushInterval) {
      this.flushInterval = setInterval(() => this.flush(), maxWaitMs)
    }
  }

  async add(item: T): Promise<R> {
    this.batch.push(item)

    if (this.batch.length >= this.batchSize) {
      return this.flushOne()
    }

    // Return a promise that will resolve when the batch is processed
    return new Promise((resolve, reject) => {
      this.once("processed", (results: R[]) => {
        const index = this.batch.length - 1
        resolve(results[index])
      })
      this.once("error", reject)

      // Auto-flush after max wait time
      setTimeout(() => {
        if (this.batch.includes(item)) {
          this.flushOne().then(resolve).catch(reject)
        }
      }, this.maxWaitMs)
    })
  }

  private async flushOne(): Promise<R> {
    if (this.processing) {
      // Wait for current batch to complete
      await new Promise<void>((resolve) => {
        this.once("processed", () => resolve())
      })
    }

    if (this.batch.length === 0) {
      throw new Error("No items to process")
    }

    const item = this.batch.shift()!
    if (this.batch.length >= this.batchSize - 1) {
      await this.flush()
    }

    return this.processOne(item)
  }

  private async processOne(item: T): Promise<R> {
    try {
      const results = await this.processor([item])
      return results[0]
    } catch (error) {
      throw error
    }
  }

  private async flush(): Promise<R[]> {
    if (this.processing || this.batch.length === 0) {
      return []
    }

    this.processing = true
    const currentBatch = [...this.batch]
    this.batch = []

    try {
      // console.info("batch_processor.flushing", { batch_size: currentBatch.length })

      const results = await this.processor(currentBatch)
      this.emit("processed", results)

      return results
    } catch (error) {
      this.emit("error", error)
      throw error
    } finally {
      this.processing = false
    }
  }

  private events: { [event: string]: Function[] } = {}

  private on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  private once(event: string, listener: Function) {
    const onceListener = (...args: any[]) => {
      listener(...args)
      this.off(event, onceListener)
    }
    this.on(event, onceListener)
  }

  private emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args))
    }
  }

  private off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((l) => l !== listener)
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.batch = []
    this.events = {}
  }
}

/**
 * Connection pool for managing API connections
 */
export class ConnectionPool<T> {
  private connections: T[] = []
  private inUse = new Set<T>()

  constructor(
    private factory: () => Promise<T>,
    private maxConnections: number,
    private validator?: (connection: T) => Promise<boolean>,
  ) {}

  async acquire(): Promise<T> {
    // Try to find an available connection
    for (const connection of this.connections) {
      if (!this.inUse.has(connection)) {
        // Validate connection if validator provided
        if (this.validator) {
          const isValid = await this.validator(connection)
          if (!isValid) {
            this.connections = this.connections.filter((c) => c !== connection)
            continue
          }
        }

        this.inUse.add(connection)
        return connection
      }
    }

    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const connection = await this.factory()
      this.connections.push(connection)
      this.inUse.add(connection)
      return connection
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      const checkAvailability = () => {
        for (const connection of this.connections) {
          if (!this.inUse.has(connection)) {
            this.inUse.add(connection)
            resolve(connection)
            return
          }
        }
        setTimeout(checkAvailability, 100)
      }
      checkAvailability()
    })
  }

  release(connection: T): void {
    this.inUse.delete(connection)
  }

  async closeAll(): Promise<void> {
    // Implementation depends on the connection type
    // For HTTP connections, this might close keep-alive connections
    this.connections = []
    this.inUse.clear()
  }

  getStats() {
    return {
      totalConnections: this.connections.length,
      activeConnections: this.inUse.size,
      availableConnections: this.connections.length - this.inUse.size,
      utilizationPercent:
        this.connections.length > 0 ? (this.inUse.size / this.connections.length) * 100 : 0,
    }
  }
}

/**
 * Memoization utility for expensive function calls
 */
export class Memoizer<K, V> {
  private cache = new Map<K, { value: V; timestamp: number; hits: number }>()

  constructor(
    private ttlMs: number,
    private maxSize = 1000,
  ) {}

  async get(key: K, fn: () => Promise<V>): Promise<V> {
    const cached = this.cache.get(key)

    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      cached.hits++
      return cached.value
    }

    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldEntries()
    }

    const value = await fn()
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1,
    })

    return value
  }

  private evictOldEntries() {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    const toEvict = Math.floor(this.maxSize * 0.1) // Evict 10% oldest
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  clear() {
    this.cache.clear()
  }

  getStats() {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    const avgHits = entries.length > 0 ? totalHits / entries.length : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
      totalHits,
      averageHits: avgHits,
    }
  }
}
