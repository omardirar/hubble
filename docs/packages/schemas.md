# @hubble/schemas

Shared validation schemas and type definitions for the Hubble platform.

## Overview

The `@hubble/schemas` package provides comprehensive validation schemas using Zod for type-safe data validation across the entire Hubble platform. It includes schemas for chat, connect, and common data structures with proper error handling and type inference.

## Installation

```bash
pnpm add @hubble/schemas
```

## Exports

### Chat Schemas

#### `ConversationSchema`

Schema for conversation validation.

```typescript
import { ConversationSchema } from "@hubble/schemas"

const conversation = ConversationSchema.parse({
    id: "conv_123",
    org_id: "org_456",
    owner_user_id: "user_789",
    title: "Marketing Discussion",
    status: "active",
    model: "claude-3-sonnet",
    system_prompt: "You are a helpful assistant.",
})
```

#### `MessageSchema`

Schema for message validation.

```typescript
import { MessageSchema } from "@hubble/schemas"

const message = MessageSchema.parse({
    id: "msg_123",
    conversation_id: "conv_456",
    org_id: "org_789",
    owner_user_id: "user_101",
    author_user_id: "user_101",
    role: "user",
    content: { text: "Hello, how can you help me?" },
    model: "claude-3-sonnet",
})
```

#### `CreateConversationSchema`

Schema for creating new conversations.

```typescript
import { CreateConversationSchema } from "@hubble/schemas"

const conversationData = CreateConversationSchema.parse({
    title: "New Discussion",
    model: "claude-3-sonnet",
    system_prompt: "You are a helpful assistant.",
})
```

#### `CreateMessageSchema`

Schema for creating new messages.

```typescript
import { CreateMessageSchema } from "@hubble/schemas"

const messageData = CreateMessageSchema.parse({
    conversation_id: "conv_123",
    role: "user",
    content: { text: "Hello!" },
    model: "claude-3-sonnet",
})
```

### Connect Schemas

#### `ProvisionRunSchema`

Schema for provisioning run validation.

```typescript
import { ProvisionRunSchema } from "@hubble/schemas"

const provisionRun = ProvisionRunSchema.parse({
    correlation_id: "prov_123",
    org_id: "org_456",
    status: "running",
    md_db_name: "md_org_456",
    md_sa_username: "sa_org_456",
    fivetran_destination_id: "dest_789",
})
```

#### `DataDestinationSchema`

Schema for data destination validation.

```typescript
import { DataDestinationSchema } from "@hubble/schemas"

const destination = DataDestinationSchema.parse({
    id: "dest_123",
    org_id: "org_456",
    md_db_name: "md_org_456",
    md_token_ref: "token_789",
    fivetran_destination_id: "fivetran_101",
    status: "healthy",
})
```

#### `DataConnectionSchema`

Schema for data connection validation.

```typescript
import { DataConnectionSchema } from "@hubble/schemas"

const connection = DataConnectionSchema.parse({
    id: "conn_123",
    org_id: "org_456",
    source_type: "facebook_ads",
    fivetran_connector_id: "connector_789",
    schema_name: "facebook_ads",
    status: "syncing",
})
```

#### `ConnectorTypeSchema`

Schema for connector type validation.

```typescript
import { ConnectorTypeSchema } from "@hubble/schemas"

const connectorType = ConnectorTypeSchema.parse("facebook_ads")
// Validates against: 'facebook_ads' | 'google_ads' | 'tiktok_ads' | 'linkedin_ads'
```

### Common Schemas

#### `OrganizationSchema`

Schema for organization validation.

```typescript
import { OrganizationSchema } from "@hubble/schemas"

const organization = OrganizationSchema.parse({
    org_id: "org_123",
    slug: "acme-corp",
    status: "ready",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
})
```

#### `UserSchema`

Schema for user validation.

```typescript
import { UserSchema } from "@hubble/schemas"

const user = UserSchema.parse({
    user_id: "user_123",
    email: "user@example.com",
    first_name: "John",
    last_name: "Doe",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
})
```

#### `IdempotencyKeySchema`

Schema for idempotency key validation.

```typescript
import { IdempotencyKeySchema } from "@hubble/schemas"

const idempotencyKey = IdempotencyKeySchema.parse("msg_123_456_789")
// Validates UUID format
```

### Type Definitions

#### `Conversation`

```typescript
import type { Conversation } from "@hubble/schemas"

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

```typescript
import type { Message } from "@hubble/schemas"

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

```typescript
import type { ProvisionRun } from "@hubble/schemas"

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

## Usage Examples

### Basic Validation

```typescript
import { ConversationSchema, MessageSchema, CreateConversationSchema } from "@hubble/schemas"
import { ZodError } from "zod"

// Validate conversation data
try {
    const conversation = ConversationSchema.parse({
        id: "conv_123",
        org_id: "org_456",
        owner_user_id: "user_789",
        title: "Marketing Discussion",
        status: "active",
        model: "claude-3-sonnet",
    })

    console.log("Valid conversation:", conversation)
} catch (error) {
    if (error instanceof ZodError) {
        console.error("Validation errors:", error.errors)
    }
}

// Validate message data
try {
    const message = MessageSchema.parse({
        id: "msg_123",
        conversation_id: "conv_456",
        org_id: "org_789",
        owner_user_id: "user_101",
        author_user_id: "user_101",
        role: "user",
        content: { text: "Hello!" },
    })

    console.log("Valid message:", message)
} catch (error) {
    if (error instanceof ZodError) {
        console.error("Validation errors:", error.errors)
    }
}
```

### API Request Validation

```typescript
import { CreateConversationSchema, CreateMessageSchema } from "@hubble/schemas"
import { Request, Response } from "express"

// Validate conversation creation request
export async function createConversation(req: Request, res: Response) {
    try {
        const conversationData = CreateConversationSchema.parse(req.body)

        // Process valid data
        const conversation = await createConversationInDB(conversationData)

        res.json({ conversation })
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                error: "Validation failed",
                details: error.errors,
            })
        } else {
            res.status(500).json({ error: "Internal server error" })
        }
    }
}

// Validate message creation request
export async function createMessage(req: Request, res: Response) {
    try {
        const messageData = CreateMessageSchema.parse(req.body)

        // Process valid data
        const message = await createMessageInDB(messageData)

        res.json({ message })
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                error: "Validation failed",
                details: error.errors,
            })
        } else {
            res.status(500).json({ error: "Internal server error" })
        }
    }
}
```

### Database Integration

```typescript
import { ConversationSchema, MessageSchema, ProvisionRunSchema } from "@hubble/schemas"
import { createBrowserClient } from "@hubble/db"

const supabase = createBrowserClient({ authToken })

// Validate data before database operations
async function createConversation(data: unknown) {
    // Validate input data
    const conversationData = ConversationSchema.parse(data)

    // Insert into database
    const { data: conversation, error } = await supabase
        .from("conversations")
        .insert(conversationData)
        .select()
        .single()

    if (error) throw error

    // Validate response data
    return ConversationSchema.parse(conversation)
}

// Validate data from database
async function getConversation(id: string) {
    const { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .single()

    if (error) throw error

    // Validate response data
    return ConversationSchema.parse(conversation)
}
```

### Type-Safe API Responses

```typescript
import { ConversationSchema, MessageSchema, type Conversation, type Message } from "@hubble/schemas"

// Type-safe API response
interface APIResponse<T> {
    data: T
    error: null
}

interface APIError {
    data: null
    error: {
        message: string
        code: string
    }
}

// Conversation API response
type ConversationResponse = APIResponse<Conversation> | APIError

async function getConversation(id: string): Promise<ConversationResponse> {
    try {
        const conversation = await fetchConversationFromDB(id)

        // Validate response data
        const validConversation = ConversationSchema.parse(conversation)

        return {
            data: validConversation,
            error: null,
        }
    } catch (error) {
        return {
            data: null,
            error: {
                message: "Failed to fetch conversation",
                code: "CONVERSATION_NOT_FOUND",
            },
        }
    }
}
```

### Form Validation

```typescript
import {
  CreateConversationSchema,
  CreateMessageSchema
} from '@hubble/schemas'
import { useState } from 'react'

function ConversationForm() {
  const [formData, setFormData] = useState({
  title: '',
  model: 'claude-3-sonnet',
  system_prompt: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  try {
    // Validate form data
    const validData = CreateConversationSchema.parse(formData)

    // Submit valid data
    await createConversation(validData)

    // Clear errors
    setErrors({})
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {}

      error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })

      setErrors(fieldErrors)
    }
  }
  }

  return (
  <form onSubmit={handleSubmit}>
    <div>
      <label>Title</label>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
      />
      {errors.title && <span className="error">{errors.title}</span>}
    </div>

    <div>
      <label>Model</label>
      <select
        value={formData.model}
        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
      >
        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
        <option value="claude-3-opus">Claude 3 Opus</option>
      </select>
      {errors.model && <span className="error">{errors.model}</span>}
    </div>

    <div>
      <label>System Prompt</label>
      <textarea
        value={formData.system_prompt}
        onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
      />
      {errors.system_prompt && <span className="error">{errors.system_prompt}</span>}
    </div>

    <button type="submit">Create Conversation</button>
  </form>
  )
}
```

### Custom Validation

```typescript
import { z } from "zod"
import { ConversationSchema } from "@hubble/schemas"

// Extend existing schema
const ExtendedConversationSchema = ConversationSchema.extend({
    tags: z.array(z.string()).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
})

// Create custom schema
const CustomMessageSchema = z.object({
    content: z.object({
        text: z.string().min(1),
        attachments: z
            .array(
                z.object({
                    type: z.enum(["image", "file", "link"]),
                    url: z.string().url(),
                    name: z.string().optional(),
                }),
            )
            .optional(),
    }),
    metadata: z.record(z.any()).optional(),
})

// Use custom schemas
const extendedConversation = ExtendedConversationSchema.parse({
    id: "conv_123",
    org_id: "org_456",
    owner_user_id: "user_789",
    title: "Marketing Discussion",
    status: "active",
    model: "claude-3-sonnet",
    tags: ["marketing", "strategy"],
    priority: "high",
})

const customMessage = CustomMessageSchema.parse({
    content: {
        text: "Check out this image",
        attachments: [
            {
                type: "image",
                url: "https://example.com/image.jpg",
                name: "marketing-chart.png",
            },
        ],
    },
    metadata: {
        source: "web",
        user_agent: "Mozilla/5.0...",
    },
})
```

## Schema Reference

### Chat Schema Definitions

#### ConversationSchema Definition

```typescript
const ConversationSchema = z.object({
    id: z.string().uuid(),
    org_id: z.string(),
    owner_user_id: z.string(),
    title: z.string().min(1).max(255),
    status: z.enum(["active", "archived"]),
    archived_at: z.string().datetime().nullable().optional(),
    model: z.string(),
    system_prompt: z.string().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

#### MessageSchema Definition

```typescript
const MessageSchema = z.object({
    id: z.string().uuid(),
    conversation_id: z.string().uuid(),
    org_id: z.string(),
    owner_user_id: z.string(),
    author_user_id: z.string(),
    role: z.enum(["user", "assistant", "system", "tool", "function"]),
    content: z.any(),
    text_content: z.string(),
    model: z.string().optional(),
    tool_name: z.string().optional(),
    tool_call_id: z.string().optional(),
    error: z.string().optional(),
    idempotency_key: z.string().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

### Connect Schema Definitions

#### ProvisionRunSchema Definition

```typescript
const ProvisionRunSchema = z.object({
    correlation_id: z.string().uuid(),
    org_id: z.string(),
    status: z.enum(["pending", "running", "ready", "failed"]),
    md_db_name: z.string().optional(),
    md_sa_username: z.string().optional(),
    fivetran_destination_id: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    error_message: z.string().optional(),
    started_at: z.string().datetime().optional(),
    finished_at: z.string().datetime().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

#### DataDestinationSchema Definition

```typescript
const DataDestinationSchema = z.object({
    id: z.string().uuid(),
    org_id: z.string(),
    md_db_name: z.string().regex(/^md_[a-z0-9_-]+$/),
    md_token_ref: z.string().optional(),
    fivetran_destination_id: z.string().optional(),
    status: z.enum(["pending", "healthy", "unhealthy"]),
    last_event_at: z.string().datetime().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

### Common Schema Definitions

#### OrganizationSchema Definition

```typescript
const OrganizationSchema = z.object({
    org_id: z.string(),
    slug: z.string().min(1).max(100),
    status: z.enum(["provisioning", "ready", "suspended", "failed"]),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

#### UserSchema Definition

```typescript
const UserSchema = z.object({
    user_id: z.string(),
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})
```

## Error Handling

### Validation Errors

```typescript
import { ZodError } from "zod"
import { ConversationSchema } from "@hubble/schemas"

try {
    const conversation = ConversationSchema.parse(invalidData)
} catch (error) {
    if (error instanceof ZodError) {
        // Handle validation errors
        error.errors.forEach((err) => {
            console.error(`Field ${err.path.join(".")}: ${err.message}`)
        })
    }
}
```

### Custom Error Messages

```typescript
import { z } from "zod"

const CustomConversationSchema = z.object({
    title: z
        .string()
        .min(1, "Title is required")
        .max(255, "Title must be less than 255 characters"),
    status: z.enum(["active", "archived"], {
        errorMap: () => ({ message: "Status must be either active or archived" }),
    }),
})
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from "vitest"
import { ConversationSchema, MessageSchema } from "@hubble/schemas"

describe("@hubble/schemas", () => {
    describe("ConversationSchema", () => {
        it("should validate valid conversation data", () => {
            const validData = {
                id: "123e4567-e89b-12d3-a456-426614174000",
                org_id: "org_123",
                owner_user_id: "user_456",
                title: "Test Conversation",
                status: "active",
                model: "claude-3-sonnet",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
            }

            const result = ConversationSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it("should reject invalid conversation data", () => {
            const invalidData = {
                id: "invalid-uuid",
                org_id: "",
                title: "",
                status: "invalid",
            }

            const result = ConversationSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { ConversationSchema, MessageSchema, CreateConversationSchema } from "@hubble/schemas"

describe("Schema Integration", () => {
    it("should validate end-to-end data flow", () => {
        // Create conversation
        const conversationData = CreateConversationSchema.parse({
            title: "Test Conversation",
            model: "claude-3-sonnet",
        })

        // Create message
        const messageData = MessageSchema.parse({
            id: "123e4567-e89b-12d3-a456-426614174000",
            conversation_id: "123e4567-e89b-12d3-a456-426614174001",
            org_id: "org_123",
            owner_user_id: "user_456",
            author_user_id: "user_456",
            role: "user",
            content: { text: "Hello!" },
            text_content: "Hello!",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
        })

        expect(conversationData.title).toBe("Test Conversation")
        expect(messageData.role).toBe("user")
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Schema Names**: Update schema import names
2. **Validation Methods**: Update validation method calls
3. **Type Definitions**: Update type imports

```typescript
// Before (v0.x)
import { Conversation, Message } from "@hubble/schemas"

// After (v1.x)
import { ConversationSchema, MessageSchema } from "@hubble/schemas"
import type { Conversation, Message } from "@hubble/schemas"
```

## Troubleshooting

### Common Issues

1. **Validation Failures**

- Check data format and types
- Verify required fields
- Review enum values

2. **Type Errors**

- Ensure proper type imports
- Check schema definitions
- Verify data structure

3. **Performance Issues**

- Use safeParse for validation
- Implement proper error handling
- Consider schema optimization

### Debug Mode

Enable debug logging:

```env
SCHEMA_DEBUG=true
VALIDATION_DEBUG=true
```

## Contributing

When contributing to `@hubble/schemas`:

1. **Follow Patterns**: Maintain consistency with existing schemas
2. **Add Tests**: Include comprehensive tests for new schemas
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/types**](./types.md) - Shared TypeScript types
- [**@hubble/core**](./core.md) - Core utilities and error handling
