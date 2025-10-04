# @hubble/chat

Chat functionality and database operations for the Hubble platform.

## Overview

The `@hubble/chat` package provides comprehensive chat functionality including conversation management, message handling, AI integration, and real-time updates. It's designed to work seamlessly with the Supabase database and provides a clean API for chat operations.

## Installation

```bash
pnpm add @hubble/chat
```

## Exports

### Database Operations

#### `getConversations(supabase, logger)`

Fetch conversations for the authenticated user.

```typescript
import { getConversations } from "@hubble/chat"
import { createBrowserClient } from "@hubble/db"

const supabase = createBrowserClient({ authToken })
const conversations = await getConversations(supabase, logger)
```

#### `createConversation(supabase, data, logger)`

Create a new conversation.

```typescript
import { createConversation } from "@hubble/chat"

const conversation = await createConversation(
    supabase,
    {
        title: "Marketing Strategy Discussion",
        model: "claude-3-sonnet",
        system_prompt: "You are a helpful marketing assistant.",
    },
    logger,
)
```

#### `updateConversation(supabase, id, data, logger)`

Update an existing conversation.

```typescript
import { updateConversation } from "@hubble/chat"

const updatedConversation = await updateConversation(
    supabase,
    conversationId,
    {
        title: "Updated Title",
        status: "archived",
    },
    logger,
)
```

#### `getMessages(supabase, conversationId, logger)`

Fetch messages for a conversation.

```typescript
import { getMessages } from "@hubble/chat"

const messages = await getMessages(supabase, conversationId, logger)
```

#### `createMessage(supabase, data, logger)`

Create a new message in a conversation.

```typescript
import { createMessage } from "@hubble/chat"

const message = await createMessage(
    supabase,
    {
        conversation_id: conversationId,
        role: "user",
        content: { text: "Hello, how can you help me?" },
        idempotency_key: "unique-key-123",
    },
    logger,
)
```

#### `findExistingMessage(supabase, conversationId, idempotencyKey, logger)`

Find an existing message by idempotency key.

```typescript
import { findExistingMessage } from "@hubble/chat"

const existingMessage = await findExistingMessage(
    supabase,
    conversationId,
    "unique-key-123",
    logger,
)
```

#### `verifyConversationAccess(supabase, conversationId, userId, logger)`

Verify user access to a conversation.

```typescript
import { verifyConversationAccess } from "@hubble/chat"

const hasAccess = await verifyConversationAccess(supabase, conversationId, userId, logger)
```

### React Hooks

#### `useChatState(conversationId)`

React hook for managing chat state.

```typescript
import { useChatState } from '@hubble/chat'

function ChatComponent({ conversationId }) {
  const {
  messages,
  loading,
  error,
  sendMessage,
  createConversation,
  updateConversation
  } = useChatState(conversationId)

  return (
  <div>
    {messages.map(message => (
      <div key={message.id}>{message.text_content}</div>
    ))}
  </div>
  )
}
```

### Types

#### `Conversation`

```typescript
interface Conversation {
    id: string
    org_id: string
    owner_user_id: string
    title: string
    status: "active" | "archived"
    archived_at?: string
    model: string
    system_prompt?: string
    created_at: string
    updated_at: string
}
```

#### `Message`

```typescript
interface Message {
    id: string
    conversation_id: string
    org_id: string
    owner_user_id: string
    author_user_id: string
    role: "user" | "assistant" | "system" | "tool" | "function"
    content: any
    text_content: string
    model?: string
    tool_name?: string
    tool_call_id?: string
    error?: string
    idempotency_key?: string
    created_at: string
    updated_at: string
}
```

#### `CreateConversationData`

```typescript
interface CreateConversationData {
    title: string
    model: string
    system_prompt?: string
}
```

#### `CreateMessageData`

```typescript
interface CreateMessageData {
    conversation_id: string
    role: "user" | "assistant" | "system" | "tool" | "function"
    content: any
    model?: string
    tool_name?: string
    tool_call_id?: string
    error?: string
    idempotency_key?: string
}
```

## Usage Examples

### Basic Chat Operations

```typescript
import { getConversations, createConversation, getMessages, createMessage } from "@hubble/chat"
import { createBrowserClient } from "@hubble/db"
import { logger } from "@hubble/logger"

// Initialize Supabase client
const supabase = createBrowserClient({ authToken })

// Get all conversations
const conversations = await getConversations(supabase, logger)
console.log("Conversations:", conversations)

// Create a new conversation
const conversation = await createConversation(
    supabase,
    {
        title: "Marketing Strategy Discussion",
        model: "claude-3-sonnet",
        system_prompt: "You are a helpful marketing assistant.",
    },
    logger,
)

// Get messages for the conversation
const messages = await getMessages(supabase, conversation.id, logger)

// Send a message
const message = await createMessage(
    supabase,
    {
        conversation_id: conversation.id,
        role: "user",
        content: { text: "What are the best marketing strategies for 2024?" },
        idempotency_key: "msg-123",
    },
    logger,
)
```

### React Integration

```typescript
import React from 'react'
import { useChatState } from '@hubble/chat'

function ChatInterface({ conversationId }) {
  const {
  messages,
  loading,
  error,
  sendMessage,
  createConversation
  } = useChatState(conversationId)

  const handleSendMessage = async (text) => {
  try {
    await sendMessage({
      role: 'user',
      content: { text },
      idempotency_key: `msg-${Date.now()}`
    })
  } catch (error) {
    console.error('Failed to send message:', error)
  }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
  <div className="chat-interface">
    <div className="messages">
      {messages.map(message => (
        <div key={message.id} className={`message ${message.role}`}>
          <div className="content">{message.text_content}</div>
          <div className="timestamp">{message.created_at}</div>
        </div>
      ))}
    </div>
    <div className="input-area">
      <input
        type="text"
        placeholder="Type your message..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage(e.target.value)
            e.target.value = ''
          }
        }}
      />
    </div>
  </div>
  )
}
```

### Idempotent Message Creation

```typescript
import { createMessage, findExistingMessage } from "@hubble/chat"

async function sendMessageSafely(supabase, conversationId, content, logger) {
    const idempotencyKey = `msg-${Date.now()}-${Math.random()}`

    // Check if message already exists
    const existingMessage = await findExistingMessage(
        supabase,
        conversationId,
        idempotencyKey,
        logger,
    )

    if (existingMessage) {
        logger.info("Message already exists, returning existing message")
        return existingMessage
    }

    // Create new message
    return await createMessage(
        supabase,
        {
            conversation_id: conversationId,
            role: "user",
            content,
            idempotency_key: idempotencyKey,
        },
        logger,
    )
}
```

### Conversation Management

```typescript
import { getConversations, createConversation, updateConversation } from "@hubble/chat"

async function manageConversations(supabase, logger) {
    // Get all conversations
    const conversations = await getConversations(supabase, logger)

    // Create a new conversation
    const newConversation = await createConversation(
        supabase,
        {
            title: "New Discussion",
            model: "claude-3-sonnet",
        },
        logger,
    )

    // Update conversation
    const updatedConversation = await updateConversation(
        supabase,
        newConversation.id,
        {
            title: "Updated Discussion Title",
            status: "archived",
        },
        logger,
    )

    return { conversations, newConversation, updatedConversation }
}
```

### Error Handling

```typescript
import { getConversations, createConversation, DatabaseError, ValidationError } from "@hubble/chat"
import { logger } from "@hubble/logger"

async function handleChatOperations(supabase, logger) {
    try {
        const conversations = await getConversations(supabase, logger)
        return conversations
    } catch (error) {
        if (error instanceof DatabaseError) {
            logger.error("Database error fetching conversations", { error: error.message })
            throw new Error("Failed to fetch conversations")
        }

        if (error instanceof ValidationError) {
            logger.warn("Validation error", { error: error.message })
            throw new Error("Invalid conversation data")
        }

        logger.error("Unexpected error", { error: error.message })
        throw error
    }
}
```

## Database Schema

### Conversations Table

```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status conversation_status NOT NULL,
  archived_at TIMESTAMPTZ,
  model TEXT,
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE conversation_status AS ENUM ('active', 'archived');
```

### Messages Table

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id),
  org_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  role message_role NOT NULL,
  content JSONB NOT NULL,
  text_content TEXT GENERATED ALWAYS AS (content->>'text') STORED,
  model TEXT,
  tool_name TEXT,
  tool_call_id TEXT,
  error TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, idempotency_key) WHERE idempotency_key IS NOT NULL
);

CREATE TYPE message_role AS ENUM (
  'user', 'assistant', 'system', 'tool', 'function'
);
```

## Security Considerations

### Row Level Security (RLS)

All chat operations respect RLS policies:

```sql
-- Conversations RLS policy
CREATE POLICY "conversations_org_isolation" ON public.conversations
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::text);

-- Messages RLS policy
CREATE POLICY "messages_org_isolation" ON public.messages
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id')::text);
```

### Data Validation

- **Input Validation**: All inputs are validated using Zod schemas
- **Content Sanitization**: Message content is sanitized before storage
- **Idempotency**: Duplicate message prevention using idempotency keys
- **Access Control**: User access verification for all operations

## Performance Optimization

### Database Indexes

```sql
-- Conversation indexes
CREATE INDEX idx_conversations_org_id ON public.conversations(org_id);
CREATE INDEX idx_conversations_owner_user_id ON public.conversations(owner_user_id);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at);

-- Message indexes
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_org_id ON public.messages(org_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
```

### Caching Strategy

- **Conversation List**: Cache conversation lists with TTL
- **Message History**: Cache recent messages for fast access
- **User Context**: Cache user permissions and access rights

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { createConversation, createMessage } from "@hubble/chat"

describe("@hubble/chat", () => {
    describe("createConversation", () => {
        it("should create conversation with valid data", async () => {
            const mockSupabase = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { id: "conv_123", title: "Test Conversation" },
                                error: null,
                            }),
                        }),
                    }),
                }),
            }

            const conversation = await createConversation(
                mockSupabase,
                {
                    title: "Test Conversation",
                    model: "claude-3-sonnet",
                },
                logger,
            )

            expect(conversation.id).toBe("conv_123")
            expect(conversation.title).toBe("Test Conversation")
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { createBrowserClient } from "@hubble/db"
import { getConversations, createConversation } from "@hubble/chat"

describe("Chat Integration", () => {
    it("should perform CRUD operations", async () => {
        const supabase = createBrowserClient({ authToken: "test-token" })

        // Create conversation
        const conversation = await createConversation(
            supabase,
            {
                title: "Test Conversation",
                model: "claude-3-sonnet",
            },
            logger,
        )

        expect(conversation).toBeDefined()
        expect(conversation.title).toBe("Test Conversation")

        // Get conversations
        const conversations = await getConversations(supabase, logger)
        expect(conversations).toContainEqual(
            expect.objectContaining({
                id: conversation.id,
                title: "Test Conversation",
            }),
        )
    })
})
```

## Migration Guide

### From v0.x to v1.x

1. **Function Names**: Update function imports
2. **Error Handling**: Use new error classes
3. **Type Definitions**: Update type imports

```typescript
// Before (v0.x)
import { getChatConversations, createChatMessage } from "@hubble/chat"

// After (v1.x)
import { getConversations, createMessage } from "@hubble/chat"
```

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**

- Check JWT token has `org_id` claim
- Verify user is in the correct organization
- Test with different users

2. **Message Creation Errors**

- Verify conversation exists
- Check idempotency key uniqueness
- Validate message content format

3. **Performance Issues**

- Check database indexes
- Monitor query performance
- Implement proper caching

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
CHAT_DEBUG=true
```

## Contributing

When contributing to `@hubble/chat`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/db**](./db.md) - Database client factories
- [**@hubble/auth**](./auth.md) - Authentication utilities
- [**@hubble/core**](./core.md) - Core utilities and error handling
- [**@hubble/types**](./types.md) - Shared TypeScript types
