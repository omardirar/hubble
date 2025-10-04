# @hubble/db

Supabase client factories and database utilities for the Hubble platform.

## Overview

The `@hubble/db` package provides Supabase client factories and database utilities that handle authentication, organization context, and database operations. It includes both browser and server-side clients with proper Row Level Security (RLS) configuration.

## Installation

```bash
pnpm add @hubble/db
```

## Exports

### Client Factories

#### `createBrowserClient({ authToken })`

Create a client-side Supabase client that respects RLS policies.

```typescript
import { createBrowserClient } from "@hubble/db"

const supabase = createBrowserClient({
    authToken: "your-jwt-token",
})

// Use for user operations (respects RLS)
const { data } = await supabase.from("conversations").select("*").eq("org_id", orgId)
```

#### `createServiceClient()`

Create a server-side service role client that bypasses RLS.

```typescript
import { createServiceClient } from "@hubble/db"

const supabase = createServiceClient()

// Use for admin operations (bypasses RLS)
const { data } = await supabase.from("system.audit_events").select("*")
```

### REST API Client

#### `createRestClient({ authToken })`

Create a REST API client for server-side operations.

```typescript
import { createRestClient } from "@hubble/db"

const client = createRestClient({
    authToken: "your-jwt-token",
})

// Use for REST API calls
const response = await client.post("/api/v1/chat/conversations", {
    title: "New Conversation",
})
```

## Usage Examples

### Basic Database Operations

```typescript
import { createBrowserClient, createServiceClient } from "@hubble/db"

// Client-side operations (with RLS)
async function getUserConversations(authToken: string, orgId: string) {
    const supabase = createBrowserClient({ authToken })

    const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })

    if (error) throw error
    return data
}

// Server-side operations (admin access)
async function getSystemAuditEvents() {
    const supabase = createServiceClient()

    const { data, error } = await supabase
        .from("system.audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

    if (error) throw error
    return data
}
```

### Organization-Scoped Operations

```typescript
import { createBrowserClient } from "@hubble/db"
import { getOrgId } from "@hubble/auth"

// Get current user's organization data
async function getOrganizationData(authToken: string, userId: string) {
    const supabase = createBrowserClient({ authToken })
    const orgId = await getOrgId(userId)

    if (!orgId) {
        throw new Error("User not in organization")
    }

    // RLS automatically filters by org_id
    const { data, error } = await supabase
        .from("v_organizations")
        .select("*")
        .eq("org_id", orgId)
        .single()

    if (error) throw error
    return data
}
```

### Real-time Subscriptions

```typescript
import { createBrowserClient } from "@hubble/db"

// Subscribe to real-time updates
function subscribeToConversations(
    authToken: string,
    orgId: string,
    callback: (payload: any) => void,
) {
    const supabase = createBrowserClient({ authToken })

    const subscription = supabase
        .channel("conversations")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "conversations",
                filter: `org_id=eq.${orgId}`,
            },
            callback,
        )
        .subscribe()

    return () => subscription.unsubscribe()
}

// Usage
const unsubscribe = subscribeToConversations(token, orgId, (payload) => {
    console.log("Conversation updated:", payload)
})

// Cleanup
unsubscribe()
```

### File Storage Operations

```typescript
import { createBrowserClient } from "@hubble/db"

// Upload file
async function uploadFile(authToken: string, file: File, bucket: string) {
    const supabase = createBrowserClient({ authToken })

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`${Date.now()}-${file.name}`, file)

    if (error) throw error
    return data
}

// Download file
async function downloadFile(authToken: string, bucket: string, path: string) {
    const supabase = createBrowserClient({ authToken })

    const { data, error } = await supabase.storage.from(bucket).download(path)

    if (error) throw error
    return data
}
```

### Database Functions

```typescript
import { createBrowserClient } from "@hubble/db"

// Call database function
async function createConversation(authToken: string, title: string) {
    const supabase = createBrowserClient({ authToken })

    const { data, error } = await supabase.rpc("create_conversation", {
        p_title: title,
        p_model: "claude-3-sonnet",
    })

    if (error) throw error
    return data
}

// Call with organization context
async function getOrganizationStats(authToken: string, orgId: string) {
    const supabase = createBrowserClient({ authToken })

    const { data, error } = await supabase.rpc("get_org_stats", {
        p_org_id: orgId,
    })

    if (error) throw error
    return data
}
```

## Configuration

### Environment Variables

The package requires the following environment variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Custom Supabase URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

### Supabase Setup

1. **Create Supabase Project**

- Go to [supabase.com](https://supabase.com)
- Create a new project
- Get your project URL and keys

2. **Configure RLS Policies**

- Set up Row Level Security policies
- Ensure proper organization scoping
- Test policies with different users

3. **Database Schema**

- Run necessary migrations
- Set up proper indexes
- Configure foreign key constraints

## TypeScript Types

### Database Entities

```typescript
// Conversation entity
interface Conversation {
    id: string
    org_id: string
    owner_user_id: string
    title: string
    status: "active" | "archived"
    model: string
    system_prompt?: string
    created_at: Date
    updated_at: Date
    archived_at?: Date
}

// Message entity
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
    created_at: Date
    updated_at: Date
}
```

### Client Configuration

```typescript
interface BrowserClientConfig {
    authToken: string
    options?: SupabaseClientOptions
}

interface ServiceClientConfig {
    options?: SupabaseClientOptions
}

interface RestClientConfig {
    authToken: string
    baseUrl?: string
}
```

## Error Handling

### Database Errors

```typescript
import { createBrowserClient } from "@hubble/db"
import { DatabaseError } from "@hubble/core"

async function safeDatabaseOperation(authToken: string) {
    const supabase = createBrowserClient({ authToken })

    try {
        const { data, error } = await supabase.from("conversations").select("*")

        if (error) {
            throw new DatabaseError("Database operation failed", {
                operation: "select",
                table: "conversations",
                code: error.code,
                details: error.message,
            })
        }

        return data
    } catch (error) {
        if (error instanceof DatabaseError) {
            throw error
        }

        throw new DatabaseError("Unexpected database error", {
            operation: "select",
            originalError: error,
        })
    }
}
```

### Common Error Codes

```typescript
// PostgreSQL error codes
const ERROR_CODES = {
    UNIQUE_VIOLATION: "23505",
    FOREIGN_KEY_VIOLATION: "23503",
    NOT_NULL_VIOLATION: "23502",
    CHECK_VIOLATION: "23514",
    INVALID_TEXT_REPRESENTATION: "22P02",
} as const

// Handle specific errors
if (error.code === ERROR_CODES.UNIQUE_VIOLATION) {
    throw new DatabaseError("Duplicate entry", {
        code: "DUPLICATE_ENTRY",
        field: "email",
    })
}
```

## Security Considerations

### Row Level Security (RLS)

1. **Always Use RLS**: Ensure all tables have proper RLS policies
2. **Organization Scoping**: Filter data by organization ID
3. **User Context**: Use JWT claims for user context
4. **Test Policies**: Regularly test RLS policies

### Client Selection

1. **Browser Client**: Use for user operations (respects RLS)
2. **Service Client**: Use for admin operations (bypasses RLS)
3. **Never Mix**: Don't use service client for user operations

### Best Practices

1. **Validate Input**: Always validate input data
2. **Use Transactions**: Use transactions for complex operations
3. **Handle Errors**: Implement proper error handling
4. **Monitor Queries**: Monitor database performance

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { createBrowserClient, createServiceClient } from "@hubble/db"

describe("@hubble/db", () => {
    describe("createBrowserClient", () => {
        it("should create client with auth token", () => {
            const client = createBrowserClient({ authToken: "test-token" })
            expect(client).toBeDefined()
        })
    })

    describe("createServiceClient", () => {
        it("should create service client", () => {
            const client = createServiceClient()
            expect(client).toBeDefined()
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { createBrowserClient } from "@hubble/db"

describe("Database Integration", () => {
    it("should perform CRUD operations", async () => {
        const supabase = createBrowserClient({ authToken: "test-token" })

        // Test create
        const { data: created } = await supabase
            .from("conversations")
            .insert({ title: "Test Conversation" })
            .select()
            .single()

        expect(created).toBeDefined()
        expect(created.title).toBe("Test Conversation")

        // Test read
        const { data: read } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", created.id)
            .single()

        expect(read).toEqual(created)

        // Test update
        const { data: updated } = await supabase
            .from("conversations")
            .update({ title: "Updated Title" })
            .eq("id", created.id)
            .select()
            .single()

        expect(updated.title).toBe("Updated Title")

        // Test delete
        const { error } = await supabase.from("conversations").delete().eq("id", created.id)

        expect(error).toBeNull()
    })
})
```

## Performance Optimization

### Query Optimization

1. **Use Indexes**: Ensure proper database indexes
2. **Limit Results**: Use pagination for large datasets
3. **Select Specific Fields**: Only select needed fields
4. **Use Views**: Use database views for complex queries

### Caching

```typescript
import { createBrowserClient } from "@hubble/db"

// Cache frequently accessed data
const cache = new Map()

async function getCachedData(authToken: string, key: string) {
    if (cache.has(key)) {
        return cache.get(key)
    }

    const supabase = createBrowserClient({ authToken })
    const { data } = await supabase.from("organizations").select("*").eq("org_id", key).single()

    cache.set(key, data)
    return data
}
```

## Migration Guide

### From v0.x to v1.x

1. **Client Factory Names**: Update function imports
2. **Configuration**: Update client configuration
3. **Error Handling**: Use new error classes

```typescript
// Before (v0.x)
import { createClient, createAdminClient } from "@hubble/db"

// After (v1.x)
import { createBrowserClient, createServiceClient } from "@hubble/db"
```

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**

- Check RLS policies are enabled
- Verify organization context
- Test with different users

2. **Authentication Errors**

- Verify JWT token validity
- Check token expiration
- Ensure proper token format

3. **Connection Errors**

- Check Supabase URL and keys
- Verify network connectivity
- Check firewall settings

### Debug Mode

Enable debug logging:

```env
SUPABASE_DEBUG=true
LOG_LEVEL=debug
```

## Contributing

When contributing to `@hubble/db`:

1. **Security First**: Ensure all changes maintain security
2. **Test Coverage**: Add comprehensive tests
3. **Documentation**: Update documentation for changes
4. **Performance**: Consider performance implications

## Related Packages

- [**@hubble/auth**](../auth/README.md) - Authentication utilities
- [**@hubble/core**](../core/README.md) - Core utilities and error handling
- [**@hubble/types**](../types/README.md) - Shared TypeScript types
