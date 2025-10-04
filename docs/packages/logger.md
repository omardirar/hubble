# @hubble/logger

Comprehensive logging system with structured logging, performance monitoring, and observability features for the Hubble platform.

## Overview

The `@hubble/logger` package provides a powerful, structured logging system designed for modern applications. It includes browser and server-side logging, performance monitoring, specialized loggers for different use cases, and comprehensive observability features.

## Installation

```bash
pnpm add @hubble/logger
```

## Exports

### Core Logging

#### `logger`

Main logger instance with structured logging capabilities.

```typescript
import { logger } from "@hubble/logger"

// Basic logging
logger.info("User logged in", { userId: "123", email: "user@example.com" })
logger.warn("Rate limit approaching", { userId: "123", current: 90, limit: 100 })
logger.error("Database connection failed", { error: "Connection timeout" })

// Performance logging
logger.performance("Database query", {
    operation: "getUser",
    duration: 150,
    query: "SELECT * FROM users WHERE id = ?",
})
```

#### `createLogger(config)`

Create a custom logger instance.

```typescript
import { createLogger } from "@hubble/logger"

const customLogger = createLogger({
    level: "debug",
    service: "auth-service",
    version: "1.0.0",
})
```

### Browser Logging

#### `browserLogger`

Browser-specific logger with console integration.

```typescript
import { browserLogger } from "@hubble/logger"

// Browser logging
browserLogger.info("Page loaded", {
    url: window.location.href,
    loadTime: performance.now(),
})

// Error tracking
browserLogger.error("JavaScript error", {
    error: error.message,
    stack: error.stack,
    url: window.location.href,
})
```

### Specialized Loggers

#### `DatabaseLogger`

Specialized logger for database operations.

```typescript
import { DatabaseLogger } from "@hubble/logger"

const dbLogger = new DatabaseLogger({
    service: "database",
    level: "debug",
})

// Query logging
dbLogger.query("SELECT * FROM users", {
    duration: 45,
    rows: 100,
    params: ["user_123"],
})

// Transaction logging
dbLogger.transaction("user_update", {
    duration: 120,
    operations: 3,
    success: true,
})
```

#### `APILogger`

Specialized logger for API operations.

```typescript
import { APILogger } from "@hubble/logger"

const apiLogger = new APILogger({
    service: "api",
    level: "info",
})

// Request logging
apiLogger.request("POST", "/api/users", {
    duration: 200,
    status: 201,
    userId: "user_123",
})

// Response logging
apiLogger.response("GET", "/api/users", {
    duration: 150,
    status: 200,
    count: 25,
})
```

### Performance Monitoring

#### `PerformanceLogger`

Performance monitoring and metrics collection.

```typescript
import { PerformanceLogger } from "@hubble/logger"

const perfLogger = new PerformanceLogger({
    service: "performance",
    level: "info",
})

// Start performance measurement
const timer = perfLogger.startTimer("database_query")

// ... perform operation ...

// End measurement
perfLogger.endTimer(timer, {
    operation: "getUser",
    success: true,
})

// Custom metrics
perfLogger.metric("response_time", 150, {
    endpoint: "/api/users",
    method: "GET",
})
```

### Middleware

#### `requestLogger`

Express middleware for request logging.

```typescript
import { requestLogger } from "@hubble/logger"
import express from "express"

const app = express()

app.use(
    requestLogger({
        service: "api",
        level: "info",
    }),
)

app.get("/api/users", (req, res) => {
    // Request will be automatically logged
    res.json({ users: [] })
})
```

#### `errorLogger`

Express middleware for error logging.

```typescript
import { errorLogger } from "@hubble/logger"
import express from "express"

const app = express()

app.use(
    errorLogger({
        service: "api",
        level: "error",
    }),
)

app.get("/api/users", (req, res, next) => {
    try {
        // Some operation that might fail
        throw new Error("Something went wrong")
    } catch (error) {
        next(error) // Error will be automatically logged
    }
})
```

### React Components

#### `LogProvider`

React context provider for logging.

```typescript
import { LogProvider } from '@hubble/logger'
import React from 'react'

function App() {
  return (
  <LogProvider
    service="frontend"
    level="info"
    userId="user_123"
  >
    <YourApp />
  </LogProvider>
  )
}
```

#### `useLogger`

React hook for logging in components.

```typescript
import { useLogger } from '@hubble/logger'
import React from 'react'

function UserComponent({ userId }) {
  const logger = useLogger()

  React.useEffect(() => {
  logger.info('Component mounted', { userId })
  }, [userId])

  const handleClick = () => {
  logger.info('Button clicked', { userId, action: 'click' })
  }

  return <button onClick={handleClick}>Click me</button>
}
```

### Types

#### `LogLevel`

```typescript
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal"
```

#### `LogConfig`

```typescript
interface LogConfig {
    level?: LogLevel
    service?: string
    version?: string
    environment?: string
    userId?: string
    requestId?: string
    tags?: Record<string, string>
    metadata?: Record<string, any>
}
```

#### `LogEntry`

```typescript
interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    service?: string
    version?: string
    userId?: string
    requestId?: string
    tags?: Record<string, string>
    metadata?: Record<string, any>
    error?: {
        name: string
        message: string
        stack: string
    }
}
```

#### `PerformanceEntry`

```typescript
interface PerformanceEntry {
    name: string
    duration: number
    startTime: number
    endTime: number
    metadata?: Record<string, any>
}
```

## Usage Examples

### Basic Logging

```typescript
import { logger } from "@hubble/logger"

// Simple logging
logger.info("Application started")
logger.warn("Configuration missing", { key: "API_URL" })
logger.error("Database connection failed", {
    error: "Connection timeout",
    retries: 3,
})

// Structured logging with context
logger.info("User action", {
    userId: "user_123",
    action: "login",
    ip: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
})
```

### Performance Examples

```typescript
import { PerformanceLogger } from "@hubble/logger"

const perfLogger = new PerformanceLogger({
    service: "api",
    level: "info",
})

async function processUserData(userId) {
    const timer = perfLogger.startTimer("process_user_data")

    try {
        // Fetch user data
        const user = await fetchUser(userId)
        perfLogger.metric("user_fetch_duration", Date.now() - timer.startTime)

        // Process data
        const processedData = await processData(user)
        perfLogger.metric("data_processing_duration", Date.now() - timer.startTime)

        // Save results
        await saveResults(processedData)
        perfLogger.metric("save_duration", Date.now() - timer.startTime)

        perfLogger.endTimer(timer, {
            operation: "process_user_data",
            success: true,
            userId,
        })

        return processedData
    } catch (error) {
        perfLogger.endTimer(timer, {
            operation: "process_user_data",
            success: false,
            error: error.message,
            userId,
        })
        throw error
    }
}
```

### Database Logging

```typescript
import { DatabaseLogger } from "@hubble/logger"

const dbLogger = new DatabaseLogger({
    service: "database",
    level: "debug",
})

async function getUserById(id) {
    const timer = dbLogger.startTimer("get_user_by_id")

    try {
        const query = "SELECT * FROM users WHERE id = ?"
        const result = await database.query(query, [id])

        dbLogger.query(query, {
            duration: timer.end(),
            rows: result.length,
            params: [id],
            success: true,
        })

        return result[0]
    } catch (error) {
        dbLogger.query("SELECT * FROM users WHERE id = ?", {
            duration: timer.end(),
            error: error.message,
            params: [id],
            success: false,
        })
        throw error
    }
}
```

### API Logging

```typescript
import { APILogger } from "@hubble/logger"
import express from "express"

const apiLogger = new APILogger({
    service: "api",
    level: "info",
})

const app = express()

// Request logging middleware
app.use((req, res, next) => {
    const timer = apiLogger.startTimer("request")

    req.logger = apiLogger
    req.timer = timer

    next()
})

// Response logging middleware
app.use((req, res, next) => {
    const originalSend = res.send

    res.send = function (data) {
        req.logger.response(req.method, req.path, {
            duration: req.timer.end(),
            status: res.statusCode,
            userId: req.user?.id,
        })

        return originalSend.call(this, data)
    }

    next()
})

app.get("/api/users", async (req, res) => {
    try {
        const users = await getUsers()
        res.json({ users })
    } catch (error) {
        req.logger.error("Failed to get users", {
            error: error.message,
            userId: req.user?.id,
        })
        res.status(500).json({ error: "Internal server error" })
    }
})
```

### React Integration

```typescript
import { LogProvider, useLogger } from '@hubble/logger'
import React from 'react'

function App() {
  return (
  <LogProvider
    service="frontend"
    level="info"
    userId="user_123"
    tags={{ environment: 'production' }}
  >
    <UserDashboard />
  </LogProvider>
  )
}

function UserDashboard() {
  const logger = useLogger()

  React.useEffect(() => {
  logger.info('Dashboard loaded', {
    component: 'UserDashboard',
    timestamp: new Date().toISOString()
  })
  }, [])

  const handleUserAction = (action) => {
  logger.info('User action', {
    action,
    component: 'UserDashboard',
    timestamp: new Date().toISOString()
  })
  }

  return (
  <div>
    <button onClick={() => handleUserAction('click_button')}>
      Click me
    </button>
  </div>
  )
}
```

### Error Handling

```typescript
import { logger } from "@hubble/logger"

async function handleUserRequest(userId) {
    try {
        const user = await getUser(userId)
        logger.info("User retrieved successfully", { userId })
        return user
    } catch (error) {
        logger.error("Failed to retrieve user", {
            userId,
            error: error.message,
            stack: error.stack,
            operation: "getUser",
        })

        // Re-throw with additional context
        throw new Error(`Failed to retrieve user ${userId}: ${error.message}`)
    }
}
```

### Custom Logger

```typescript
import { createLogger } from "@hubble/logger"

const customLogger = createLogger({
    level: "debug",
    service: "custom-service",
    version: "1.0.0",
    environment: "production",
    tags: {
        team: "backend",
        component: "auth",
    },
    metadata: {
        region: "us-east-1",
        instance: "api-1",
    },
})

// Use custom logger
customLogger.info("Custom service started", {
    config: "loaded",
    features: ["auth", "logging"],
})
```

## Configuration

### Environment Variables

```env
# Logging Configuration
LOG_LEVEL=info
LOG_SERVICE=hubble-api
LOG_VERSION=1.0.0
LOG_ENVIRONMENT=production

# Performance Monitoring
PERF_LOG_ENABLED=true
PERF_LOG_THRESHOLD=100

# Error Tracking
ERROR_LOG_ENABLED=true
ERROR_LOG_STACK_TRACE=true
```

### Logger Configuration

```typescript
import { createLogger } from "@hubble/logger"

const logger = createLogger({
    level: process.env.LOG_LEVEL || "info",
    service: process.env.LOG_SERVICE || "hubble",
    version: process.env.LOG_VERSION || "1.0.0",
    environment: process.env.LOG_ENVIRONMENT || "development",
    tags: {
        team: "backend",
        component: "api",
    },
    metadata: {
        region: process.env.AWS_REGION,
        instance: process.env.INSTANCE_ID,
    },
})
```

## Performance Optimization

### Log Level Filtering

```typescript
import { createLogger } from "@hubble/logger"

// Production logger with minimal logging
const prodLogger = createLogger({
    level: "warn", // Only log warnings and errors
    service: "api",
})

// Development logger with verbose logging
const devLogger = createLogger({
    level: "debug", // Log everything
    service: "api",
})
```

### Async Logging

```typescript
import { createLogger } from "@hubble/logger"

const logger = createLogger({
    service: "api",
    async: true, // Enable async logging
    batchSize: 100, // Batch logs for better performance
    flushInterval: 5000, // Flush every 5 seconds
})
```

### Structured Logging

```typescript
import { logger } from "@hubble/logger"

// Use structured logging for better performance
logger.info("User action", {
    userId: "user_123",
    action: "login",
    timestamp: Date.now(),
    metadata: {
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
    },
})
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { createLogger } from "@hubble/logger"

describe("@hubble/logger", () => {
    describe("createLogger", () => {
        it("should create logger with correct configuration", () => {
            const logger = createLogger({
                level: "info",
                service: "test-service",
            })

            expect(logger).toBeDefined()
            expect(logger.level).toBe("info")
            expect(logger.service).toBe("test-service")
        })
    })

    describe("logging methods", () => {
        it("should log info messages", () => {
            const logger = createLogger({ level: "info" })
            const consoleSpy = vi.spyOn(console, "log")

            logger.info("Test message", { key: "value" })

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Test message"))
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { logger, PerformanceLogger } from "@hubble/logger"

describe("Logger Integration", () => {
    it("should perform end-to-end logging", () => {
        // Test basic logging
        logger.info("Test message", { key: "value" })

        // Test performance logging
        const perfLogger = new PerformanceLogger({ service: "test" })
        const timer = perfLogger.startTimer("test_operation")

        // Simulate operation
        setTimeout(() => {
            perfLogger.endTimer(timer, { success: true })
        }, 100)
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Logger Creation**: Update logger creation syntax
2. **Method Names**: Update method names
3. **Configuration**: Update configuration options

```typescript
// Before (v0.x)
import { Logger } from "@hubble/logger"
const logger = new Logger({ level: "info" })

// After (v1.x)
import { createLogger } from "@hubble/logger"
const logger = createLogger({ level: "info" })
```

## Troubleshooting

### Common Issues

1. **Log Level Issues**

- Check LOG_LEVEL environment variable
- Verify logger configuration
- Review log output

2. **Performance Issues**

- Enable async logging
- Adjust batch size
- Review log volume

3. **Memory Leaks**

- Check timer cleanup
- Review logger instances
- Monitor memory usage

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
LOGGER_DEBUG=true
```

## Contributing

When contributing to `@hubble/logger`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/core**](./core.md) - Core utilities and error handling
- [**@hubble/types**](./types.md) - Shared TypeScript types
