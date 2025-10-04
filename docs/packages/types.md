# @hubble/types

Shared TypeScript type definitions for the Hubble platform.

## Overview

The `@hubble/types` package provides comprehensive TypeScript type definitions used across the entire Hubble platform. It includes types for database entities, API responses, configuration objects, and shared interfaces to ensure type safety and consistency.

## Installation

```bash
pnpm add @hubble/types
```

## Exports

### Database Types

#### `Conversation`

Type for conversation entities.

```typescript
import type { Conversation } from "@hubble/types"

const conversation: Conversation = {
    id: "conv_123",
    org_id: "org_456",
    owner_user_id: "user_789",
    title: "Marketing Discussion",
    status: "active",
    archived_at: null,
    model: "claude-3-sonnet",
    system_prompt: "You are a helpful assistant.",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
}
```

#### `Message`

Type for message entities.

```typescript
import type { Message } from "@hubble/types"

const message: Message = {
    id: "msg_123",
    conversation_id: "conv_456",
    org_id: "org_789",
    owner_user_id: "user_101",
    author_user_id: "user_101",
    role: "user",
    content: { text: "Hello, how can you help me?" },
    text_content: "Hello, how can you help me?",
    model: "claude-3-sonnet",
    tool_name: null,
    tool_call_id: null,
    error: null,
    idempotency_key: "msg_123_456",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
}
```

#### `ProvisionRun`

Type for provisioning run entities.

```typescript
import type { ProvisionRun } from "@hubble/types"

const provisionRun: ProvisionRun = {
    correlation_id: "prov_123",
    org_id: "org_456",
    status: "running",
    md_db_name: "md_org_456",
    md_sa_username: "sa_org_456",
    fivetran_destination_id: "dest_789",
    metadata: { current_step: "Creating database" },
    error_message: null,
    started_at: "2024-01-01T00:00:00Z",
    finished_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
}
```

#### `DataDestination`

Type for data destination entities.

```typescript
import type { DataDestination } from "@hubble/types"

const destination: DataDestination = {
    id: "dest_123",
    org_id: "org_456",
    md_db_name: "md_org_456",
    md_token_ref: "token_789",
    fivetran_destination_id: "fivetran_101",
    status: "healthy",
    last_event_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
}
```

#### `DataConnection`

Type for data connection entities.

```typescript
import type { DataConnection } from "@hubble/types"

const connection: DataConnection = {
    id: "conn_123",
    org_id: "org_456",
    source_type: "facebook_ads",
    fivetran_connector_id: "connector_789",
    schema_name: "facebook_ads",
    status: "syncing",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
}
```

### API Types

#### `APIResponse`

Generic API response type.

```typescript
import type { APIResponse } from "@hubble/types"

const response: APIResponse<Conversation> = {
    data: conversation,
    error: null,
}

const errorResponse: APIResponse<null> = {
    data: null,
    error: {
        message: "Not found",
        code: "NOT_FOUND",
    },
}
```

#### `APIError`

Type for API errors.

```typescript
import type { APIError } from "@hubble/types"

const error: APIError = {
    message: "Validation failed",
    code: "VALIDATION_ERROR",
    details: {
        field: "title",
        message: "Title is required",
    },
}
```

#### `PaginatedResponse`

Type for paginated API responses.

```typescript
import type { PaginatedResponse } from "@hubble/types"

const paginatedResponse: PaginatedResponse<Conversation> = {
    data: [conversation1, conversation2],
    pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
    },
    error: null,
}
```

### Configuration Types

#### `DatabaseConfig`

Type for database configuration.

```typescript
import type { DatabaseConfig } from "@hubble/types"

const dbConfig: DatabaseConfig = {
    url: "postgresql://localhost:5432/hubble",
    password: "password",
    ssl: true,
    pool: {
        min: 2,
        max: 10,
    },
}
```

#### `RedisConfig`

Type for Redis configuration.

```typescript
import type { RedisConfig } from "@hubble/types"

const redisConfig: RedisConfig = {
    url: "redis://localhost:6379",
    password: "password",
    db: 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
}
```

#### `APIConfig`

Type for API configuration.

```typescript
import type { APIConfig } from "@hubble/types"

const apiConfig: APIConfig = {
    baseUrl: "https://api.hubble.com",
    timeout: 30000,
    retries: 3,
    headers: {
        "User-Agent": "Hubble-Client/1.0.0",
    },
}
```

### Utility Types

#### `Optional<T, K>`

Make specific keys optional.

```typescript
import type { Optional } from "@hubble/types"

type CreateConversationData = Optional<Conversation, "id" | "created_at" | "updated_at">

const createData: CreateConversationData = {
    org_id: "org_456",
    owner_user_id: "user_789",
    title: "New Conversation",
    status: "active",
    model: "claude-3-sonnet",
    // id, created_at, updated_at are optional
}
```

#### `Required<T, K>`

Make specific keys required.

```typescript
import type { Required } from "@hubble/types"

type UpdateConversationData = Required<Conversation, "id" | "updated_at">

const updateData: UpdateConversationData = {
    id: "conv_123",
    updated_at: "2024-01-01T00:00:00Z",
    // All other fields are optional
}
```

#### `Partial<T>`

Make all keys optional.

```typescript
import type { Partial } from "@hubble/types"

type ConversationUpdate = Partial<Conversation>

const update: ConversationUpdate = {
    title: "Updated Title",
    status: "archived",
    // All other fields are optional
}
```

### Enum Types

#### `ConversationStatus`

Enum for conversation status values.

```typescript
import type { ConversationStatus } from "@hubble/types"

const status: ConversationStatus = "active" // 'active' | 'archived'
```

#### `MessageRole`

Enum for message role values.

```typescript
import type { MessageRole } from "@hubble/types"

const role: MessageRole = "user" // 'user' | 'assistant' | 'system' | 'tool' | 'function'
```

#### `ProvisionStatus`

Enum for provisioning status values.

```typescript
import type { ProvisionStatus } from "@hubble/types"

const status: ProvisionStatus = "running" // 'pending' | 'running' | 'ready' | 'failed'
```

#### `ConnectorType`

Enum for connector type values.

```typescript
import type { ConnectorType } from "@hubble/types"

const connectorType: ConnectorType = "facebook_ads" // 'facebook_ads' | 'google_ads' | 'tiktok_ads' | 'linkedin_ads'
```

### Function Types

#### `DatabaseFunction`

Type for database function signatures.

```typescript
import type { DatabaseFunction } from "@hubble/types"

const getUser: DatabaseFunction<[string], User> = async (userId) => {
    // Implementation
}
```

#### `APIFunction`

Type for API function signatures.

```typescript
import type { APIFunction } from "@hubble/types"

const createConversation: APIFunction<[CreateConversationData], Conversation> = async (data) => {
    // Implementation
}
```

#### `EventHandler`

Type for event handler signatures.

```typescript
import type { EventHandler } from "@hubble/types"

const handleUserCreated: EventHandler<UserCreatedEvent> = (event) => {
    // Implementation
}
```

## Usage Examples

### Basic Type Usage

```typescript
import type { Conversation, Message, APIResponse, ConversationStatus } from "@hubble/types"

// Function with typed parameters
async function getConversation(id: string): Promise<APIResponse<Conversation>> {
    try {
        const conversation = await fetchConversation(id)

        return {
            data: conversation,
            error: null,
        }
    } catch (error) {
        return {
            data: null,
            error: {
                message: "Failed to fetch conversation",
                code: "FETCH_ERROR",
            },
        }
    }
}

// Function with enum types
function updateConversationStatus(
    conversation: Conversation,
    status: ConversationStatus,
): Conversation {
    return {
        ...conversation,
        status,
        updated_at: new Date().toISOString(),
    }
}
```

### Generic Type Usage

```typescript
import type { APIResponse, PaginatedResponse, Optional, Required } from "@hubble/types"

// Generic API response handler
async function handleAPIResponse<T>(response: APIResponse<T>): Promise<T> {
    if (response.error) {
        throw new Error(response.error.message)
    }

    return response.data
}

// Generic pagination handler
function processPaginatedData<T>(response: PaginatedResponse<T>): T[] {
    if (response.error) {
        throw new Error(response.error.message)
    }

    return response.data
}

// Using utility types
type CreateMessageData = Optional<Message, "id" | "created_at" | "updated_at">

function createMessage(data: CreateMessageData): Message {
    return {
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data,
    }
}
```

### Configuration Type Usage

```typescript
import type { DatabaseConfig, RedisConfig, APIConfig } from "@hubble/types"

// Database configuration
const dbConfig: DatabaseConfig = {
    url: process.env.DATABASE_URL!,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === "production",
    pool: {
        min: 2,
        max: 10,
    },
}

// Redis configuration
const redisConfig: RedisConfig = {
    url: process.env.REDIS_URL!,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
}

// API configuration
const apiConfig: APIConfig = {
    baseUrl: process.env.API_BASE_URL!,
    timeout: parseInt(process.env.API_TIMEOUT || "30000"),
    retries: 3,
    headers: {
        "User-Agent": "Hubble-Client/1.0.0",
        Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
}
```

### Event Type Usage

```typescript
import type { UserCreatedEvent, ConversationCreatedEvent, MessageCreatedEvent } from "@hubble/types"

// Event handler with typed event
function handleUserCreated(event: UserCreatedEvent) {
    console.log("User created:", event.userId)
    console.log("Email:", event.email)
    console.log("Timestamp:", event.timestamp)
}

// Event handler with typed event
function handleConversationCreated(event: ConversationCreatedEvent) {
    console.log("Conversation created:", event.conversationId)
    console.log("Organization:", event.orgId)
    console.log("Owner:", event.ownerUserId)
}
```

### API Route Type Usage

```typescript
import type { Conversation, Message, APIResponse, CreateConversationData } from "@hubble/types"

// API route with typed request/response
export async function POST(request: Request): Promise<Response> {
    try {
        const data: CreateConversationData = await request.json()

        // Validate data
        const conversation = await createConversation(data)

        const response: APIResponse<Conversation> = {
            data: conversation,
            error: null,
        }

        return Response.json(response)
    } catch (error) {
        const errorResponse: APIResponse<null> = {
            data: null,
            error: {
                message: error instanceof Error ? error.message : "Unknown error",
                code: "INTERNAL_ERROR",
            },
        }

        return Response.json(errorResponse, { status: 500 })
    }
}
```

### React Component Type Usage

```typescript
import type {
  Conversation,
  Message,
  ConversationStatus
} from '@hubble/types'
import React from 'react'

interface ConversationProps {
  conversation: Conversation
  onStatusChange: (status: ConversationStatus) => void
}

function ConversationComponent({ conversation, onStatusChange }: ConversationProps) {
  const handleStatusChange = (newStatus: ConversationStatus) => {
  onStatusChange(newStatus)
  }

  return (
  <div>
    <h2>{conversation.title}</h2>
    <p>Status: {conversation.status}</p>
    <p>Model: {conversation.model}</p>

    <button onClick={() => handleStatusChange('archived')}>
      Archive Conversation
    </button>
  </div>
  )
}
```

### Database Query Type Usage

```typescript
import type { Conversation, Message, DatabaseQuery } from "@hubble/types"

// Typed database query
const getConversationsQuery: DatabaseQuery<Conversation[]> = {
    table: "conversations",
    select: ["*"],
    where: {
        org_id: "org_123",
        status: "active",
    },
    orderBy: {
        created_at: "DESC",
    },
    limit: 10,
}

// Typed database query with joins
const getConversationWithMessagesQuery: DatabaseQuery<Conversation & { messages: Message[] }> = {
    table: "conversations",
    select: ["*"],
    joins: [
        {
            table: "messages",
            on: "conversations.id = messages.conversation_id",
            select: ["*"],
        },
    ],
    where: {
        "conversations.id": "conv_123",
    },
}
```

## Type Reference

### Database Entity Types

```typescript
// Core entities
interface Conversation {
    id: string
    org_id: string
    owner_user_id: string
    title: string
    status: ConversationStatus
    archived_at: string | null
    model: string
    system_prompt: string | null
    created_at: string
    updated_at: string
}

interface Message {
    id: string
    conversation_id: string
    org_id: string
    owner_user_id: string
    author_user_id: string
    role: MessageRole
    content: any
    text_content: string
    model: string | null
    tool_name: string | null
    tool_call_id: string | null
    error: string | null
    idempotency_key: string | null
    created_at: string
    updated_at: string
}

interface ProvisionRun {
    correlation_id: string
    org_id: string
    status: ProvisionStatus
    md_db_name: string | null
    md_sa_username: string | null
    fivetran_destination_id: string | null
    metadata: Record<string, any> | null
    error_message: string | null
    started_at: string | null
    finished_at: string | null
    created_at: string
    updated_at: string
}
```

### API Response Types

```typescript
interface APIResponse<T> {
    data: T | null
    error: APIError | null
}

interface APIError {
    message: string
    code: string
    details?: Record<string, any>
}

interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
    error: APIError | null
}
```

### Configuration Type Definitions

```typescript
interface DatabaseConfig {
    url: string
    password?: string
    ssl?: boolean
    pool?: {
        min: number
        max: number
    }
}

interface RedisConfig {
    url: string
    password?: string
    db?: number
    retryDelayOnFailover?: number
    maxRetriesPerRequest?: number
}

interface APIConfig {
    baseUrl: string
    timeout?: number
    retries?: number
    headers?: Record<string, string>
}
```

### Enum Type Definitions

```typescript
type ConversationStatus = "active" | "archived"
type MessageRole = "user" | "assistant" | "system" | "tool" | "function"
type ProvisionStatus = "pending" | "running" | "ready" | "failed"
type ConnectorType = "facebook_ads" | "google_ads" | "tiktok_ads" | "linkedin_ads"
```

## Testing

### Type Testing

```typescript
import { describe, it, expect, expectTypeOf } from "vitest"
import type { Conversation, Message, APIResponse, ConversationStatus } from "@hubble/types"

describe("@hubble/types", () => {
    it("should have correct Conversation type", () => {
        const conversation: Conversation = {
            id: "conv_123",
            org_id: "org_456",
            owner_user_id: "user_789",
            title: "Test Conversation",
            status: "active",
            archived_at: null,
            model: "claude-3-sonnet",
            system_prompt: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
        }

        expectTypeOf(conversation.id).toBeString()
        expectTypeOf(conversation.status).toEqualTypeOf<ConversationStatus>()
    })

    it("should have correct APIResponse type", () => {
        const response: APIResponse<Conversation> = {
            data: conversation,
            error: null,
        }

        expectTypeOf(response.data).toEqualTypeOf<Conversation | null>()
        expectTypeOf(response.error).toEqualTypeOf<APIError | null>()
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Type Names**: Update type import names
2. **Interface Changes**: Update interface definitions
3. **Enum Changes**: Update enum type definitions

```typescript
// Before (v0.x)
import { Conversation, Message } from "@hubble/types"

// After (v1.x)
import type { Conversation, Message } from "@hubble/types"
```

## Troubleshooting

### Common Issues

1. **Type Errors**

- Check import statements
- Verify type definitions
- Review interface changes

2. **Generic Type Issues**

- Ensure proper generic constraints
- Check type parameter usage
- Verify type inference

3. **Enum Type Issues**

- Check enum value definitions
- Verify type assignments
- Review enum usage

### Debug Mode

Enable TypeScript strict mode:

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true
    }
}
```

## Contributing

When contributing to `@hubble/types`:

1. **Follow Patterns**: Maintain consistency with existing types
2. **Add Tests**: Include comprehensive tests for new types
3. **Update Documentation**: Update this documentation for new types
4. **Version Compatibility**: Ensure backward compatibility

## Related Packages

- [**@hubble/schemas**](./schemas.md) - Validation schemas
- [**@hubble/core**](./core.md) - Core utilities and error handling
