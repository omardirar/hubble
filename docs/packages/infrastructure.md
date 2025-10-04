# @hubble/infrastructure

Infrastructure services including Redis caching, locking, and queue management for the Hubble platform.

## Overview

The `@hubble/infrastructure` package provides essential infrastructure services including Redis-based caching, distributed locking, and queue management. It's designed to support high-performance, scalable applications with robust error handling and monitoring.

## Installation

```bash
pnpm add @hubble/infrastructure
```

## Exports

### Redis Services

#### `RedisService`

Main Redis service class for caching and general operations.

```typescript
import { RedisService } from "@hubble/infrastructure"

const redis = new RedisService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
})

// Basic operations
await redis.set("key", "value", 3600) // TTL: 1 hour
const value = await redis.get("key")
await redis.del("key")
```

#### `LockService`

Distributed locking service for critical sections.

```typescript
import { LockService } from "@hubble/infrastructure"

const lockService = new LockService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
})

// Acquire lock
const lock = await lockService.acquire("resource_123", 30000) // 30s TTL
if (lock) {
    try {
        // Critical section
        await doSomething()
    } finally {
        await lock.release()
    }
}
```

### Queue Services

#### `QStashService`

Queue service for background job processing.

```typescript
import { QStashService } from "@hubble/infrastructure"

const qstash = new QStashService({
    token: process.env.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_BASE_URL,
})

// Enqueue job
await qstash.enqueue("https://api.example.com/process", {
    body: { data: "example" },
    delay: 5000, // 5 second delay
    retries: 3,
})

// Schedule recurring job
await qstash.schedule("https://api.example.com/sync", {
    body: { type: "daily_sync" },
    cron: "0 0 * * *", // Daily at midnight
})
```

### Error Classes

#### `RedisError`

Base error class for Redis operations.

```typescript
import { RedisError } from "@hubble/infrastructure"

try {
    await redis.set("key", "value")
} catch (error) {
    if (error instanceof RedisError) {
        console.error("Redis operation failed:", error.message)
    }
}
```

#### `RedisUnavailableError`

Error thrown when Redis is unavailable.

```typescript
import { RedisUnavailableError } from "@hubble/infrastructure"

try {
    await redis.ping()
} catch (error) {
    if (error instanceof RedisUnavailableError) {
        console.error("Redis is unavailable:", error.message)
    }
}
```

#### `LockNotAcquiredError`

Error thrown when lock acquisition fails.

```typescript
import { LockNotAcquiredError } from "@hubble/infrastructure"

try {
    const lock = await lockService.acquire("resource_123")
    if (!lock) {
        throw new LockNotAcquiredError("Failed to acquire lock")
    }
} catch (error) {
    if (error instanceof LockNotAcquiredError) {
        console.error("Lock acquisition failed:", error.message)
    }
}
```

#### `LockServiceUnavailableError`

Error thrown when lock service is unavailable.

```typescript
import { LockServiceUnavailableError } from "@hubble/infrastructure"

try {
    const lock = await lockService.acquire("resource_123")
} catch (error) {
    if (error instanceof LockServiceUnavailableError) {
        console.error("Lock service unavailable:", error.message)
    }
}
```

#### `QStashError`

Error thrown when QStash operations fail.

```typescript
import { QStashError } from "@hubble/infrastructure"

try {
    await qstash.enqueue("https://api.example.com/process", {})
} catch (error) {
    if (error instanceof QStashError) {
        console.error("QStash operation failed:", error.message)
    }
}
```

### Types

#### `RedisConfig`

```typescript
interface RedisConfig {
    url: string
    password?: string
    db?: number
    retryDelayOnFailover?: number
    maxRetriesPerRequest?: number
    lazyConnect?: boolean
}
```

#### `LockConfig`

```typescript
interface LockConfig {
    url: string
    password?: string
    db?: number
    defaultTtl?: number
    retryDelay?: number
    maxRetries?: number
}
```

#### `QStashConfig`

```typescript
interface QStashConfig {
    token: string
    baseUrl?: string
    timeout?: number
    retries?: number
}
```

#### `Lock`

```typescript
interface Lock {
    key: string
    value: string
    ttl: number
    release(): Promise<void>
    extend(ttl: number): Promise<boolean>
    isHeld(): Promise<boolean>
}
```

#### `QueueJob`

```typescript
interface QueueJob {
    id: string
    url: string
    body?: any
    headers?: Record<string, string>
    delay?: number
    retries?: number
    cron?: string
    created_at: string
    status: "pending" | "running" | "completed" | "failed"
}
```

## Usage Examples

### Basic Redis Operations

```typescript
import { RedisService } from "@hubble/infrastructure"

const redis = new RedisService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
})

// String operations
await redis.set("user:123", JSON.stringify({ name: "John", email: "john@example.com" }), 3600)
const user = await redis.get("user:123")
const userData = JSON.parse(user || "{}")

// Hash operations
await redis.hset("user:123:profile", {
    name: "John Doe",
    email: "john@example.com",
    age: "30",
})
const profile = await redis.hgetall("user:123:profile")

// List operations
await redis.lpush("notifications:123", "New message", "System update")
const notifications = await redis.lrange("notifications:123", 0, -1)

// Set operations
await redis.sadd("online_users", "user_123", "user_456")
const onlineUsers = await redis.smembers("online_users")

// Expiration
await redis.expire("user:123", 3600) // 1 hour
const ttl = await redis.ttl("user:123")
```

### Distributed Locking

```typescript
import { LockService } from "@hubble/infrastructure"

const lockService = new LockService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    defaultTtl: 30000, // 30 seconds
    retryDelay: 100, // 100ms
    maxRetries: 10,
})

async function processCriticalResource(resourceId) {
    const lock = await lockService.acquire(`resource:${resourceId}`)

    if (!lock) {
        throw new Error("Failed to acquire lock")
    }

    try {
        // Critical section - only one process can execute this
        console.log("Processing resource:", resourceId)
        await doExpensiveOperation(resourceId)

        // Extend lock if needed
        const extended = await lock.extend(60000) // 1 minute
        if (!extended) {
            throw new Error("Failed to extend lock")
        }

        await doMoreWork(resourceId)
    } finally {
        await lock.release()
    }
}

// Usage
await processCriticalResource("resource_123")
```

### Queue Management

```typescript
import { QStashService } from "@hubble/infrastructure"

const qstash = new QStashService({
    token: process.env.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_BASE_URL,
})

// Enqueue immediate job
await qstash.enqueue("https://api.example.com/process", {
    body: {
        type: "data_sync",
        org_id: "org_123",
        connector_type: "facebook_ads",
    },
    headers: {
        Authorization: "Bearer " + process.env.API_TOKEN,
    },
})

// Enqueue delayed job
await qstash.enqueue("https://api.example.com/cleanup", {
    body: { type: "cleanup" },
    delay: 3600000, // 1 hour delay
    retries: 3,
})

// Schedule recurring job
await qstash.schedule("https://api.example.com/daily_sync", {
    body: { type: "daily_sync" },
    cron: "0 2 * * *", // Daily at 2 AM
    retries: 5,
})

// Get job status
const job = await qstash.getJob("job_123")
console.log("Job status:", job.status)
```

### Caching Patterns

```typescript
import { RedisService } from "@hubble/infrastructure"

const redis = new RedisService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
})

// Cache-aside pattern
async function getCachedUser(userId) {
    const cacheKey = `user:${userId}`

    // Try cache first
    let user = await redis.get(cacheKey)
    if (user) {
        return JSON.parse(user)
    }

    // Cache miss - fetch from database
    user = await fetchUserFromDatabase(userId)

    // Store in cache
    await redis.set(cacheKey, JSON.stringify(user), 3600) // 1 hour TTL

    return user
}

// Write-through pattern
async function updateUser(userId, userData) {
    // Update database
    const updatedUser = await updateUserInDatabase(userId, userData)

    // Update cache
    const cacheKey = `user:${userId}`
    await redis.set(cacheKey, JSON.stringify(updatedUser), 3600)

    return updatedUser
}

// Write-behind pattern
async function updateUserAsync(userId, userData) {
    // Update cache immediately
    const cacheKey = `user:${userId}`
    await redis.set(cacheKey, JSON.stringify(userData), 3600)

    // Queue database update
    await qstash.enqueue("https://api.example.com/update_user", {
        body: { userId, userData },
        delay: 1000, // 1 second delay
    })
}
```

### Error Handling

```typescript
import {
    RedisService,
    RedisError,
    RedisUnavailableError,
    LockService,
    LockNotAcquiredError,
    QStashService,
    QStashError,
} from "@hubble/infrastructure"

async function handleInfrastructureErrors() {
    const redis = new RedisService({ url: process.env.REDIS_URL })
    const lockService = new LockService({ url: process.env.REDIS_URL })
    const qstash = new QStashService({ token: process.env.QSTASH_TOKEN })

    try {
        // Redis operations
        await redis.set("key", "value")
    } catch (error) {
        if (error instanceof RedisUnavailableError) {
            console.error("Redis is unavailable, using fallback")
            // Implement fallback logic
        } else if (error instanceof RedisError) {
            console.error("Redis operation failed:", error.message)
            // Handle specific Redis errors
        }
    }

    try {
        // Lock operations
        const lock = await lockService.acquire("resource_123")
        if (!lock) {
            throw new LockNotAcquiredError("Failed to acquire lock")
        }
    } catch (error) {
        if (error instanceof LockNotAcquiredError) {
            console.error("Lock acquisition failed, retrying later")
            // Implement retry logic
        }
    }

    try {
        // Queue operations
        await qstash.enqueue("https://api.example.com/process", {})
    } catch (error) {
        if (error instanceof QStashError) {
            console.error("Queue operation failed:", error.message)
            // Handle queue errors
        }
    }
}
```

### Health Checks

```typescript
import { RedisService, LockService, QStashService } from "@hubble/infrastructure"

async function checkInfrastructureHealth() {
    const redis = new RedisService({ url: process.env.REDIS_URL })
    const lockService = new LockService({ url: process.env.REDIS_URL })
    const qstash = new QStashService({ token: process.env.QSTASH_TOKEN })

    const health = {
        redis: false,
        locks: false,
        queue: false,
    }

    try {
        await redis.ping()
        health.redis = true
    } catch (error) {
        console.error("Redis health check failed:", error.message)
    }

    try {
        await lockService.ping()
        health.locks = true
    } catch (error) {
        console.error("Lock service health check failed:", error.message)
    }

    try {
        await qstash.ping()
        health.queue = true
    } catch (error) {
        console.error("Queue service health check failed:", error.message)
    }

    return health
}
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# QStash Configuration
QSTASH_TOKEN=your_qstash_token
QSTASH_BASE_URL=https://qstash.upstash.io

# Infrastructure Settings
INFRASTRUCTURE_RETRY_DELAY=100
INFRASTRUCTURE_MAX_RETRIES=10
INFRASTRUCTURE_DEFAULT_TTL=30000
```

### Service Configuration

```typescript
import { RedisService, LockService, QStashService } from "@hubble/infrastructure"

// Redis configuration
const redis = new RedisService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
})

// Lock service configuration
const lockService = new LockService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    defaultTtl: 30000,
    retryDelay: 100,
    maxRetries: 10,
})

// QStash configuration
const qstash = new QStashService({
    token: process.env.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_BASE_URL,
    timeout: 30000,
    retries: 3,
})
```

## Performance Optimization

### Connection Pooling

```typescript
import { RedisService } from "@hubble/infrastructure"

const redis = new RedisService({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
})

// Connection is established on first use
await redis.ping() // Establishes connection
```

### Caching Strategies

```typescript
import { RedisService } from "@hubble/infrastructure"

const redis = new RedisService({ url: process.env.REDIS_URL })

// TTL-based expiration
await redis.set("user:123", userData, 3600) // 1 hour

// Sliding expiration
await redis.setex("session:123", 1800, sessionData) // 30 minutes

// Conditional caching
const cacheKey = "expensive_computation:123"
let result = await redis.get(cacheKey)
if (!result) {
    result = await performExpensiveComputation()
    await redis.set(cacheKey, result, 7200) // 2 hours
}
```

### Lock Optimization

```typescript
import { LockService } from "@hubble/infrastructure"

const lockService = new LockService({
    url: process.env.REDIS_URL,
    defaultTtl: 30000, // 30 seconds
    retryDelay: 50, // 50ms
    maxRetries: 20,
})

// Short-lived locks for better performance
const lock = await lockService.acquire("resource_123", 5000) // 5 seconds
if (lock) {
    try {
        await doQuickOperation()
    } finally {
        await lock.release()
    }
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { RedisService, LockService } from "@hubble/infrastructure"

describe("@hubble/infrastructure", () => {
    describe("RedisService", () => {
        it("should set and get values", async () => {
            const redis = new RedisService({ url: "redis://localhost:6379" })

            await redis.set("test_key", "test_value", 3600)
            const value = await redis.get("test_key")

            expect(value).toBe("test_value")
        })
    })

    describe("LockService", () => {
        it("should acquire and release locks", async () => {
            const lockService = new LockService({ url: "redis://localhost:6379" })

            const lock = await lockService.acquire("test_resource")
            expect(lock).toBeDefined()

            await lock.release()
            const isHeld = await lock.isHeld()
            expect(isHeld).toBe(false)
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { RedisService, LockService, QStashService } from "@hubble/infrastructure"

describe("Infrastructure Integration", () => {
    it("should perform end-to-end operations", async () => {
        const redis = new RedisService({ url: process.env.REDIS_URL })
        const lockService = new LockService({ url: process.env.REDIS_URL })
        const qstash = new QStashService({ token: process.env.QSTASH_TOKEN })

        // Test Redis operations
        await redis.set("test_key", "test_value", 3600)
        const value = await redis.get("test_key")
        expect(value).toBe("test_value")

        // Test lock operations
        const lock = await lockService.acquire("test_resource")
        expect(lock).toBeDefined()
        await lock.release()

        // Test queue operations
        const job = await qstash.enqueue("https://httpbin.org/post", {
            body: { test: "data" },
        })
        expect(job.id).toBeDefined()
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Service Names**: Update service class names
2. **Error Handling**: Use new error classes
3. **Configuration**: Update configuration options

```typescript
// Before (v0.x)
import { Redis, Lock, Queue } from "@hubble/infrastructure"

// After (v1.x)
import { RedisService, LockService, QStashService } from "@hubble/infrastructure"
```

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**

- Check Redis URL and credentials
- Verify network connectivity
- Review Redis server logs
- Test with redis-cli

2. **Lock Acquisition Failures**

- Check Redis availability
- Verify lock TTL settings
- Review retry configuration
- Monitor lock contention

3. **Queue Processing Issues**

- Verify QStash token validity
- Check endpoint accessibility
- Review job configuration
- Monitor queue status

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
INFRASTRUCTURE_DEBUG=true
```

## Contributing

When contributing to `@hubble/infrastructure`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/core**](./core.md) - Core utilities and error handling
- [**@hubble/logger**](./logger.md) - Logging utilities
- [**@hubble/types**](./types.md) - Shared TypeScript types
