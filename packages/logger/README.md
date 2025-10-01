# @hubble/logger

Comprehensive structured logging package for the Hubble platform with support for both server-side and client-side logging.

## Features

- ✅ **Structured Logging** - JSON-formatted logs with consistent context
- ✅ **Sensitive Data Redaction** - Automatic sanitization of passwords, tokens, and secrets
- ✅ **Specialized Loggers** - Domain-specific loggers for API, Database, Chat, Auth, Connect
- ✅ **Performance Monitoring** - Built-in performance tracking and threshold warnings
- ✅ **Browser Support** - Lightweight browser logger for client-side code
- ✅ **Middleware Support** - Next.js middleware for request/response logging
- ✅ **Multiple Log Levels** - DEBUG, INFO, WARN, ERROR with environment-based filtering
- ✅ **Context Management** - Child loggers with inherited context
- ✅ **Type Safe** - Full TypeScript support

## Installation

This package is part of the Hubble monorepo and is already installed:

```typescript
import { logger, structuredLogger, apiLogger } from "@hubble/logger"
```

## Quick Start

### Basic Logging

```typescript
import { structuredLogger } from "@hubble/logger"

// Simple logging
structuredLogger.info("User logged in", { userId: "123", email: "user@example.com" })
structuredLogger.warn("Rate limit approaching", { current: 95, limit: 100 })
structuredLogger.error("Database connection failed", { error: err.message }, err)
```

### Specialized Loggers

#### API Logger

```typescript
import { apiLogger } from "@hubble/logger"

// Request lifecycle
apiLogger.requestStart("req-123", "POST", "/api/users")
apiLogger.requestComplete("req-123", 201, 150) // status, duration in ms
apiLogger.requestFailed("req-123", error, 500)

// Validation and auth
apiLogger.validationFailed("req-123", validationErrors)
apiLogger.authFailed("req-123", "Invalid token")
```

#### Database Logger

```typescript
import { databaseLogger } from "@hubble/logger"

// Query lifecycle
databaseLogger.queryStart("select", "users", { userId: "123" })
databaseLogger.queryComplete("select", "users", 45, 10) // duration, row count
databaseLogger.queryFailed("insert", "users", error)

// Transactions
const txnId = "txn-456"
databaseLogger.transactionStart(txnId)
databaseLogger.transactionCommit(txnId, 200)
databaseLogger.transactionRollback(txnId, "Validation failed")
```

#### Chat Logger

```typescript
import { chatLogger } from "@hubble/logger"

// Message operations
chatLogger.messageSent("conv-123", "user-456", 150) // message length
chatLogger.messageReceived("conv-123", 200)

// Conversation management
chatLogger.conversationCreated("conv-123", "user-456", "Support Chat")
chatLogger.conversationLoaded("conv-123", 25) // message count

// AI operations
chatLogger.aiResponseStart("conv-123", 100) // prompt length
chatLogger.aiResponseComplete("conv-123", 250, 1500) // response length, duration
```

#### Connect Logger

```typescript
import { connectLogger } from "@hubble/logger"

// Provisioning workflow
connectLogger.provisionStart("corr-123", "org-456")
connectLogger.stepProgress("corr-123", "create_database", "starting")
connectLogger.stepComplete("corr-123", "create_database", 500)
connectLogger.provisionComplete("corr-123", "org-456", 2000)

// Lock management
connectLogger.lockAcquired("corr-123", "provision:org:org-456")
connectLogger.lockReleased("corr-123", "provision:org:org-456")
```

#### Auth Logger

```typescript
import { authLogger } from "@hubble/logger"

// Authentication flow
authLogger.loginAttempt("user-123", "oauth")
authLogger.loginSuccess("user-123", "oauth")
authLogger.loginFailed("user-123", "oauth", "Invalid credentials")
authLogger.logout("user-123")
authLogger.tokenRefreshed("user-123")
```

### Client-Side Logging

```typescript
import { browserLoggers } from "@hubble/logger"

// Chat logging
const logger = browserLoggers.chat("conversation-123")
logger.info("Message sent", { length: 150 })
logger.error("Send failed", { error: err.message })

// UI logging
const uiLogger = browserLoggers.ui("ChatPanel")
uiLogger.debug("Component mounted", { props: { ... } })

// API logging
const apiLogger = browserLoggers.api("/api/chat/messages")
apiLogger.info("Request started", { method: "POST" })
```

### Performance Monitoring

```typescript
import { withDatabasePerformance, createPerformanceTimer } from "@hubble/logger"

// Database operations
const users = await withDatabasePerformance(
  "select",
  "users",
  async () => {
    return await db.query("SELECT * FROM users WHERE id = $1", [userId])
  },
  { userId },
)

// General operations
const timer = createPerformanceTimer("process_payment", { amount: 100 })
// ... do work ...
const duration = timer.end({ success: true }) // Logs if threshold exceeded
```

### Context Management

```typescript
import { createStructuredLogger } from "@hubble/logger"

// Create logger with base context
const baseLogger = createStructuredLogger({
  service: "user-service",
  version: "1.0.0",
})

// Add request context
const requestLogger = baseLogger.withRequest("req-123", "POST", "/api/users")

// Add user context
const userLogger = requestLogger.withUser("user-456", "org-789")

// All logs will include all context
userLogger.info("Processing request", { action: "create_user" })
// Logs: { service: "user-service", version: "1.0.0", requestId: "req-123",
//         method: "POST", url: "/api/users", userId: "user-456", orgId: "org-789",
//         action: "create_user", message: "Processing request" }
```

### Middleware

```typescript
import { withComprehensiveLogging, withRequestLogging } from "@hubble/logger"
import { NextRequest, NextResponse } from "next/server"

// Comprehensive middleware (recommended)
export const POST = withComprehensiveLogging(async (req: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ success: true })
})

// Individual middleware
export const GET = withRequestLogging(async (req: NextRequest) => {
  // Just request/response logging
  return NextResponse.json({ data: [] })
})
```

## Configuration

### Environment Variables

```bash
# Log level (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO

# Feature toggles
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_STRUCTURED=true
LOG_ENABLE_PERFORMANCE=true
LOG_ENABLE_SECURITY=true

# Component-specific logging
LOG_ENABLE_DATABASE=true
LOG_ENABLE_API=true
LOG_ENABLE_CHAT=true
LOG_ENABLE_AUTH=true

# Advanced settings
LOG_MAX_SIZE=10485760  # 10MB
LOG_RETENTION_DAYS=30
```

### Environment Presets

```typescript
import { LOGGING_PRESETS, getEnvironmentConfig } from "@hubble/logger"

// Development: DEBUG level, all features enabled
const devConfig = LOGGING_PRESETS.development

// Production: WARN level, structured only, security enabled
const prodConfig = LOGGING_PRESETS.production

// Get config for current environment
const config = getEnvironmentConfig() // Based on NODE_ENV
```

## Security Features

### Sensitive Data Redaction

The logger automatically redacts sensitive fields from all log contexts:

```typescript
structuredLogger.info("User data", {
  email: "user@example.com",
  password: "secret123", // Redacted as [REDACTED]
  apiKey: "key_abc123", // Redacted as [REDACTED]
  name: "John Doe", // Not redacted
})
```

Redacted fields include:

- `password`, `token`, `apiKey`, `api_key`, `secret`
- `authorization`, `cookie`, `sessionId`, `session_id`
- `creditCard`, `credit_card`, `ssn`
- `email`, `phone`, `address` (in production)

### Browser-Side Security

The browser logger uses `localStorage` for configuration and includes the same redaction features to prevent sensitive data from appearing in browser console logs.

## Best Practices

### 1. Use Specialized Loggers

```typescript
// ✅ Good - Use specialized logger
import { databaseLogger } from "@hubble/logger"
databaseLogger.queryComplete("select", "users", 45, 10)

// ❌ Bad - Manual logging
console.log("Query completed in 45ms")
```

### 2. Include Sufficient Context

```typescript
// ✅ Good - Rich context
logger.error(
  "Payment failed",
  {
    userId,
    orderId,
    amount,
    paymentMethod,
    attemptCount,
  },
  error,
)

// ❌ Bad - No context
logger.error("Payment failed")
```

### 3. Use Appropriate Log Levels

```typescript
logger.debug("Verbose debugging info") // Development only
logger.info("User logged in") // Normal operations
logger.warn("Rate limit at 90%") // Potential issues
logger.error("Database connection failed") // Actual errors
```

### 4. Leverage Child Loggers

```typescript
// ✅ Good - Context inheritance
const serviceLogger = createStructuredLogger({ service: "payment" })
const userLogger = serviceLogger.withUser(userId)
userLogger.info("Processing payment") // Includes service + userId

// ❌ Bad - Repeating context
logger.info("Processing payment", { service: "payment", userId })
logger.info("Payment completed", { service: "payment", userId })
```

### 5. Never Log Sensitive Data Manually

```typescript
// ✅ Good - Redaction automatic
logger.info("User authenticated", { userId, email, token })

// ❌ Bad - Exposing sensitive data
console.log(`Token: ${token}`) // Token visible in logs!
```

### 6. Use Performance Wrappers

```typescript
// ✅ Good - Automatic threshold checking
await withDatabasePerformance("select", "users", async () => {
  return await fetchUsers()
})

// ❌ Bad - Manual timing
const start = Date.now()
const users = await fetchUsers()
console.log(`Took ${Date.now() - start}ms`)
```

## Migration from console.log

### Before

```typescript
console.log("User created", userId)
console.error("Error:", error.message)
console.warn("High memory usage")
```

### After

```typescript
import { structuredLogger } from "@hubble/logger"

structuredLogger.info("User created", { userId })
structuredLogger.error("Operation failed", { operation: "create_user" }, error)
structuredLogger.warn("High memory usage", { usage: process.memoryUsage() })
```

## Development Tips

### Enable Debug Logging

```bash
# In .env.local
LOG_LEVEL=DEBUG
```

### Browser Console Configuration

```javascript
// In browser console
localStorage.setItem("LOG_LEVEL", "DEBUG")
```

### Testing Log Output

```typescript
import { getLoggingConfig, validateLoggingConfig } from "@hubble/logger"

// Check current config
const config = getLoggingConfig()
console.log("Current log level:", config.level)

// Validate config
const errors = validateLoggingConfig(config)
if (errors.length > 0) {
  console.error("Invalid logging config:", errors)
}
```

## TypeScript Support

All loggers are fully typed:

```typescript
import type { LogContext, StructuredLogger, BrowserLogger } from "@hubble/logger"

// Custom logger with typed context
interface MyContext extends LogContext {
  userId: string
  orgId: string
  action: string
}

const logger: StructuredLogger = createStructuredLogger({
  service: "my-service",
})

// Type-safe context
const context: MyContext = {
  userId: "123",
  orgId: "456",
  action: "create",
}

logger.info("Action performed", context)
```

## Performance Considerations

- **Structured logging** has minimal overhead (~1-2ms per log in production)
- **Context sanitization** adds ~0.5ms per log with sensitive fields
- **Performance timers** use `Date.now()` for microsecond precision
- **Browser logger** uses localStorage which is synchronous but fast

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable
2. Verify component-specific flags (e.g., `LOG_ENABLE_API`)
3. In browser, check `localStorage.getItem("LOG_LEVEL")`

### Performance Issues

1. Reduce log level to `WARN` or `ERROR` in production
2. Disable debug logging: `LOG_ENABLE_PERFORMANCE=false`
3. Check log output destination (file vs console)

### Sensitive Data Leaking

1. Verify redaction is working: Check logs for `[REDACTED]`
2. Add custom sensitive fields to `SENSITIVE_FIELDS` array
3. Use `sanitizeLogContext()` manually if needed

## Roadmap

### Upcoming Features

#### Observability (v0.1.0)

- 🔄 **OpenTelemetry Integration** - Distributed tracing with span correlation
- 📊 **Metrics Collection** - Prometheus-compatible metrics export
- 🔍 **Enhanced Dashboards** - Grafana dashboards for logs, metrics, traces
- 🌐 **Context Propagation** - W3C Trace Context across service boundaries

#### UI Enhancements (v0.0.2)

- 🔔 **Toast Notifications** - Sonner integration for user-friendly error messages
- ⚠️ **Error Recovery** - Actionable error messages with retry mechanisms
- ✅ **Success Feedback** - Confirmation toasts for successful operations

See [OBSERVABILITY.md](./OBSERVABILITY.md) for detailed roadmap and implementation plan.

## License

MIT
