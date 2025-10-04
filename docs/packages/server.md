# @hubble/server

Server-side utilities and API clients for the Hubble platform.

## Overview

The `@hubble/server` package provides server-side utilities including API clients for external services, server-specific database operations, and server-side authentication helpers. It's designed to support backend operations with proper error handling and type safety.

## Installation

```bash
pnpm add @hubble/server
```

## Exports

### API Clients

#### `AnthropicClient`

Client for Anthropic Claude API integration.

```typescript
import { AnthropicClient } from "@hubble/server"

const client = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

// Generate text completion
const completion = await client.generateText({
    model: "claude-3-sonnet-20240229",
    messages: [{ role: "user", content: "Hello, how can you help me?" }],
    max_tokens: 1000,
})
```

#### `FivetranClient`

Client for Fivetran API integration.

```typescript
import { FivetranClient } from "@hubble/server"

const client = new FivetranClient({
    apiKey: process.env.FIVETRAN_API_KEY,
    apiSecret: process.env.FIVETRAN_API_SECRET,
})

// Create destination
const destination = await client.createDestination({
    service: "motherduck",
    region: "us-east-1",
    time_zone_offset: "-8",
})
```

#### `MotherDuckClient`

Client for MotherDuck API integration.

```typescript
import { MotherDuckClient } from "@hubble/server"

const client = new MotherDuckClient({
    adminToken: process.env.MD_ADMIN_TOKEN,
})

// Create database
const database = await client.createDatabase("md_org_123")

// Create service account
const serviceAccount = await client.createServiceAccount("sa_org_123")
```

### Server Database Operations

#### `getServerConversations(supabase, logger)`

Get conversations with server-side permissions.

```typescript
import { getServerConversations } from "@hubble/server"
import { createServiceClient } from "@hubble/db"

const supabase = createServiceClient()
const conversations = await getServerConversations(supabase, logger)
```

#### `getServerMessages(supabase, conversationId, logger)`

Get messages with server-side permissions.

```typescript
import { getServerMessages } from "@hubble/server"

const messages = await getServerMessages(supabase, conversationId, logger)
```

#### `createServerConversation(supabase, data, logger)`

Create conversation with server-side permissions.

```typescript
import { createServerConversation } from "@hubble/server"

const conversation = await createServerConversation(
    supabase,
    {
        title: "Server Conversation",
        model: "claude-3-sonnet",
    },
    logger,
)
```

#### `createServerMessage(supabase, data, logger)`

Create message with server-side permissions.

```typescript
import { createServerMessage } from "@hubble/server"

const message = await createServerMessage(
    supabase,
    {
        conversation_id: conversationId,
        role: "assistant",
        content: { text: "Hello from server!" },
    },
    logger,
)
```

### Authentication Helpers

#### `getServerAuthToken(request)`

Extract authentication token from server request.

```typescript
import { getServerAuthToken } from "@hubble/server"

export async function GET(request: Request) {
    const token = getServerAuthToken(request)

    if (!token) {
        return new Response("Unauthorized", { status: 401 })
    }

    // Use token for authenticated operations
    const supabase = createBrowserClient({ authToken: token })
    // ... rest of the logic
}
```

#### `validateServerToken(token)`

Validate server authentication token.

```typescript
import { validateServerToken } from "@hubble/server"

const isValid = await validateServerToken(token)
if (!isValid) {
    throw new Error("Invalid server token")
}
```

### Error Classes

#### `APIClientError`

Base error class for API client operations.

```typescript
import { APIClientError } from "@hubble/server"

try {
    await client.generateText({})
} catch (error) {
    if (error instanceof APIClientError) {
        console.error("API client error:", error.message)
    }
}
```

#### `AnthropicError`

Error thrown when Anthropic API operations fail.

```typescript
import { AnthropicError } from "@hubble/server"

try {
    await anthropicClient.generateText({})
} catch (error) {
    if (error instanceof AnthropicError) {
        console.error("Anthropic API error:", error.message)
    }
}
```

#### `FivetranError`

Error thrown when Fivetran API operations fail.

```typescript
import { FivetranError } from "@hubble/server"

try {
    await fivetranClient.createDestination({})
} catch (error) {
    if (error instanceof FivetranError) {
        console.error("Fivetran API error:", error.message)
    }
}
```

#### `MotherDuckError`

Error thrown when MotherDuck API operations fail.

```typescript
import { MotherDuckError } from "@hubble/server"

try {
    await motherDuckClient.createDatabase("test")
} catch (error) {
    if (error instanceof MotherDuckError) {
        console.error("MotherDuck API error:", error.message)
    }
}
```

### Types

#### `AnthropicConfig`

```typescript
interface AnthropicConfig {
    apiKey: string
    baseUrl?: string
    timeout?: number
    retries?: number
}
```

#### `FivetranConfig`

```typescript
interface FivetranConfig {
    apiKey: string
    apiSecret: string
    baseUrl?: string
    timeout?: number
    retries?: number
}
```

#### `MotherDuckConfig`

```typescript
interface MotherDuckConfig {
    adminToken: string
    baseUrl?: string
    timeout?: number
    retries?: number
}
```

#### `TextCompletionRequest`

```typescript
interface TextCompletionRequest {
    model: string
    messages: Array<{
        role: "user" | "assistant" | "system"
        content: string
    }>
    max_tokens: number
    temperature?: number
    top_p?: number
    stop_sequences?: string[]
}
```

#### `TextCompletionResponse`

```typescript
interface TextCompletionResponse {
    id: string
    type: string
    role: string
    content: Array<{
        type: string
        text: string
    }>
    model: string
    stop_reason: string
    stop_sequence: string | null
    usage: {
        input_tokens: number
        output_tokens: number
    }
}
```

## Usage Examples

### Anthropic Integration

```typescript
import { AnthropicClient } from "@hubble/server"

const anthropic = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

// Generate text completion
async function generateResponse(messages: Array<{ role: string; content: string }>) {
    try {
        const response = await anthropic.generateText({
            model: "claude-3-sonnet-20240229",
            messages,
            max_tokens: 1000,
            temperature: 0.7,
        })

        return response.content[0].text
    } catch (error) {
        console.error("Failed to generate text:", error)
        throw error
    }
}

// Usage in API route
export async function POST(request: Request) {
    const { messages } = await request.json()

    try {
        const response = await generateResponse(messages)

        return Response.json({
            response,
            model: "claude-3-sonnet-20240229",
        })
    } catch (error) {
        return Response.json({ error: "Failed to generate response" }, { status: 500 })
    }
}
```

### Fivetran Integration

```typescript
import { FivetranClient } from "@hubble/server"

const fivetran = new FivetranClient({
    apiKey: process.env.FIVETRAN_API_KEY,
    apiSecret: process.env.FIVETRAN_API_SECRET,
})

// Create destination
async function createFivetranDestination(orgId: string) {
    try {
        const destination = await fivetran.createDestination({
            service: "motherduck",
            region: "us-east-1",
            time_zone_offset: "-8",
            config: {
                database: `md_${orgId}`,
                host: "motherduck.com",
                port: 443,
                user: `sa_${orgId}`,
                password: "token_here",
            },
        })

        return destination
    } catch (error) {
        console.error("Failed to create Fivetran destination:", error)
        throw error
    }
}

// Create connector
async function createFivetranConnector(destinationId: string, connectorType: string) {
    try {
        const connector = await fivetran.createConnector({
            service: connectorType,
            group_id: destinationId,
            config: getConnectorConfig(connectorType),
        })

        return connector
    } catch (error) {
        console.error("Failed to create Fivetran connector:", error)
        throw error
    }
}
```

### MotherDuck Integration

```typescript
import { MotherDuckClient } from "@hubble/server"

const motherDuck = new MotherDuckClient({
    adminToken: process.env.MD_ADMIN_TOKEN,
})

// Create database and service account
async function setupMotherDuck(orgId: string) {
    try {
        // Create database
        const database = await motherDuck.createDatabase(`md_${orgId}`)
        console.log("Database created:", database.name)

        // Create service account
        const serviceAccount = await motherDuck.createServiceAccount(`sa_${orgId}`)
        console.log("Service account created:", serviceAccount.username)

        // Issue token
        const token = await motherDuck.issueToken(serviceAccount.id)
        console.log("Token issued:", token.substring(0, 20) + "...")

        return {
            database_name: database.name,
            service_account: serviceAccount.username,
            token: token,
        }
    } catch (error) {
        console.error("Failed to setup MotherDuck:", error)
        throw error
    }
}
```

### Server Database Examples

```typescript
import {
    getServerConversations,
    getServerMessages,
    createServerConversation,
    createServerMessage,
} from "@hubble/server"
import { createServiceClient } from "@hubble/db"

const supabase = createServiceClient()

// Get conversations with server permissions
async function getConversationsForOrg(orgId: string) {
    try {
        const conversations = await getServerConversations(supabase, logger)

        // Filter by organization if needed
        return conversations.filter((conv) => conv.org_id === orgId)
    } catch (error) {
        console.error("Failed to get conversations:", error)
        throw error
    }
}

// Create conversation with server permissions
async function createConversationForOrg(orgId: string, data: any) {
    try {
        const conversation = await createServerConversation(
            supabase,
            {
                ...data,
                org_id: orgId,
            },
            logger,
        )

        return conversation
    } catch (error) {
        console.error("Failed to create conversation:", error)
        throw error
    }
}
```

### Authentication Examples

```typescript
import { getServerAuthToken, validateServerToken } from "@hubble/server"

// API route with authentication
export async function GET(request: Request) {
    try {
        // Extract token from request
        const token = getServerAuthToken(request)

        if (!token) {
            return Response.json({ error: "Authentication required" }, { status: 401 })
        }

        // Validate token
        const isValid = await validateServerToken(token)
        if (!isValid) {
            return Response.json({ error: "Invalid token" }, { status: 401 })
        }

        // Proceed with authenticated operation
        const data = await getAuthenticatedData(token)

        return Response.json({ data })
    } catch (error) {
        console.error("API error:", error)
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
```

### Error Handling

```typescript
import {
    AnthropicClient,
    AnthropicError,
    FivetranClient,
    FivetranError,
    MotherDuckClient,
    MotherDuckError,
} from "@hubble/server"

async function handleAPICalls() {
    const anthropic = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY })
    const fivetran = new FivetranClient({
        apiKey: process.env.FIVETRAN_API_KEY,
        apiSecret: process.env.FIVETRAN_API_SECRET,
    })
    const motherDuck = new MotherDuckClient({ adminToken: process.env.MD_ADMIN_TOKEN })

    try {
        // Anthropic API call
        const response = await anthropic.generateText({
            model: "claude-3-sonnet-20240229",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 100,
        })

        console.log("Anthropic response:", response)
    } catch (error) {
        if (error instanceof AnthropicError) {
            console.error("Anthropic API error:", error.message)
            // Handle Anthropic-specific errors
        } else {
            console.error("Unexpected error:", error)
        }
    }

    try {
        // Fivetran API call
        const destination = await fivetran.createDestination({
            service: "motherduck",
            region: "us-east-1",
            time_zone_offset: "-8",
        })

        console.log("Fivetran destination:", destination)
    } catch (error) {
        if (error instanceof FivetranError) {
            console.error("Fivetran API error:", error.message)
            // Handle Fivetran-specific errors
        } else {
            console.error("Unexpected error:", error)
        }
    }

    try {
        // MotherDuck API call
        const database = await motherDuck.createDatabase("test_db")

        console.log("MotherDuck database:", database)
    } catch (error) {
        if (error instanceof MotherDuckError) {
            console.error("MotherDuck API error:", error.message)
            // Handle MotherDuck-specific errors
        } else {
            console.error("Unexpected error:", error)
        }
    }
}
```

## Configuration

### Environment Variables

```env
# Anthropic Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_TIMEOUT=30000

# Fivetran Configuration
FIVETRAN_API_KEY=your_fivetran_api_key
FIVETRAN_API_SECRET=your_fivetran_api_secret
FIVETRAN_BASE_URL=https://api.fivetran.com
FIVETRAN_TIMEOUT=30000

# MotherDuck Configuration
MD_ADMIN_TOKEN=your_motherduck_admin_token
MD_BASE_URL=https://api.motherduck.com
MD_TIMEOUT=30000
```

### Client Configuration

```typescript
import { AnthropicClient, FivetranClient, MotherDuckClient } from "@hubble/server"

// Anthropic client configuration
const anthropic = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || "30000"),
    retries: 3,
})

// Fivetran client configuration
const fivetran = new FivetranClient({
    apiKey: process.env.FIVETRAN_API_KEY,
    apiSecret: process.env.FIVETRAN_API_SECRET,
    baseUrl: process.env.FIVETRAN_BASE_URL,
    timeout: parseInt(process.env.FIVETRAN_TIMEOUT || "30000"),
    retries: 3,
})

// MotherDuck client configuration
const motherDuck = new MotherDuckClient({
    adminToken: process.env.MD_ADMIN_TOKEN,
    baseUrl: process.env.MD_BASE_URL,
    timeout: parseInt(process.env.MD_TIMEOUT || "30000"),
    retries: 3,
})
```

## Performance Optimization

### Connection Pooling

```typescript
import { AnthropicClient } from "@hubble/server"

const anthropic = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 30000,
    retries: 3,
})

// Client maintains connection pool internally
const response = await anthropic.generateText({
    model: "claude-3-sonnet-20240229",
    messages: [{ role: "user", content: "Hello" }],
    max_tokens: 100,
})
```

### Caching

```typescript
import { AnthropicClient } from "@hubble/server"
import { RedisService } from "@hubble/infrastructure"

const anthropic = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY })
const redis = new RedisService({ url: process.env.REDIS_URL })

async function getCachedResponse(messages: any[]) {
    const cacheKey = `anthropic:${JSON.stringify(messages)}`

    // Try cache first
    let response = await redis.get(cacheKey)
    if (response) {
        return JSON.parse(response)
    }

    // Generate new response
    response = await anthropic.generateText({
        model: "claude-3-sonnet-20240229",
        messages,
        max_tokens: 1000,
    })

    // Cache response
    await redis.set(cacheKey, JSON.stringify(response), 3600) // 1 hour TTL

    return response
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { AnthropicClient, FivetranClient } from "@hubble/server"

describe("@hubble/server", () => {
    describe("AnthropicClient", () => {
        it("should generate text completion", async () => {
            const client = new AnthropicClient({ apiKey: "test-key" })

            // Mock the API call
            vi.spyOn(client, "generateText").mockResolvedValue({
                id: "msg_123",
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "Hello!" }],
                model: "claude-3-sonnet-20240229",
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 5 },
            })

            const response = await client.generateText({
                model: "claude-3-sonnet-20240229",
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 100,
            })

            expect(response.content[0].text).toBe("Hello!")
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { AnthropicClient, FivetranClient } from "@hubble/server"

describe("Server Integration", () => {
    it("should perform end-to-end API operations", async () => {
        const anthropic = new AnthropicClient({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })

        const response = await anthropic.generateText({
            model: "claude-3-sonnet-20240229",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 100,
        })

        expect(response.content).toBeDefined()
        expect(response.content[0].text).toBeDefined()
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Client Names**: Update client class names
2. **Method Names**: Update method names
3. **Configuration**: Update configuration options

```typescript
// Before (v0.x)
import { Anthropic, Fivetran, MotherDuck } from "@hubble/server"

// After (v1.x)
import { AnthropicClient, FivetranClient, MotherDuckClient } from "@hubble/server"
```

## Troubleshooting

### Common Issues

1. **API Key Errors**

- Check environment variables
- Verify API key validity
- Review authentication headers

2. **Rate Limiting**

- Implement retry logic
- Use exponential backoff
- Monitor rate limits

3. **Network Issues**

- Check network connectivity
- Review timeout settings
- Implement proper error handling

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
SERVER_DEBUG=true
```

## Contributing

When contributing to `@hubble/server`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/db**](./db.md) - Database client factories
- [**@hubble/core**](./core.md) - Core utilities and error handling
- [**@hubble/types**](./types.md) - Shared TypeScript types
