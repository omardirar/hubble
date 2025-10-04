# @hubble/auth

Authentication and organization management utilities for the Hubble platform.

## Overview

The `@hubble/auth` package provides authentication utilities, organization context management, and JWT token handling. It integrates with Clerk for user authentication and provides organization-scoped operations for multi-tenant functionality.

## Installation

```bash
pnpm add @hubble/auth
```

## Exports

### Organization Management

#### `getOrgId(userId)`

Get organization ID from Clerk user data.

```typescript
import { getOrgId } from "@hubble/auth"

const orgId = await getOrgId("user_123")
// Returns: 'org_abc123' or null if not found
```

#### `getCurrentOrgId()`

Get current user's organization ID (server-side only).

```typescript
import { getCurrentOrgId } from "@hubble/auth"

const orgId = await getCurrentOrgId()
// Returns: 'org_abc123' or null if not authenticated
```

### JWT Token Utilities

#### `getUserAndOrgFromToken(token)`

Extract user and organization information from JWT token.

```typescript
import { getUserAndOrgFromToken } from "@hubble/auth"

const { userId, orgId, user, org } = await getUserAndOrgFromToken(jwtToken)
// Returns: { userId: string, orgId: string, user: ClerkUser, org: ClerkOrganization }
```

#### `extractJWTClaims(token)`

Parse JWT claims from token.

```typescript
import { extractJWTClaims } from "@hubble/auth"

const claims = extractJWTClaims(jwtToken)
// Returns: { sub: string, org_id: string, ... }
```

### Clerk Schema Utilities

#### `getClerkSchemaName()`

Get environment-specific Clerk schema name.

```typescript
import { getClerkSchemaName } from "@hubble/auth"

const schemaName = getClerkSchemaName()
// Returns: 'clerk' (production) or 'clerk_dev' (development)
```

#### `getClerkTableName(table)`

Get fully qualified table name for Clerk schema.

```typescript
import { getClerkTableName } from "@hubble/auth"

const tableName = getClerkTableName("users")
// Returns: 'clerk.users' or 'clerk_dev.users'
```

## Usage Examples

### Basic Authentication

```typescript
import { getOrgId, getCurrentOrgId } from "@hubble/auth"

// Client-side: Get org ID for a specific user
async function getUserOrganization(userId: string) {
    const orgId = await getOrgId(userId)
    if (!orgId) {
        throw new Error("User not associated with any organization")
    }
    return orgId
}

// Server-side: Get current user's org ID
async function getCurrentUserOrg() {
    const orgId = await getCurrentOrgId()
    if (!orgId) {
        throw new Error("User not authenticated")
    }
    return orgId
}
```

### JWT Token Handling

```typescript
import { getUserAndOrgFromToken, extractJWTClaims } from "@hubble/auth"

// Extract user and org from JWT
async function handleApiRequest(authHeader: string) {
    const token = authHeader.replace("Bearer ", "")

    try {
        const { userId, orgId, user, org } = await getUserAndOrgFromToken(token)

        // Use user and org data for request processing
        return { userId, orgId, user, org }
    } catch (error) {
        throw new Error("Invalid authentication token")
    }
}

// Parse JWT claims
function validateToken(token: string) {
    const claims = extractJWTClaims(token)

    // Check if token has required claims
    if (!claims.sub || !claims.org_id) {
        throw new Error("Invalid token claims")
    }

    return claims
}
```

### Organization Context

```typescript
import { getOrgId, getClerkTableName } from "@hubble/auth"

// Database operations with org context
async function getOrganizationData(userId: string) {
    const orgId = await getOrgId(userId)
    if (!orgId) {
        throw new Error("User not in organization")
    }

    // Query with org context
    const { data } = await supabase.from("organizations").select("*").eq("org_id", orgId).single()

    return data
}

// Clerk schema operations
async function getClerkUsers() {
    const usersTable = getClerkTableName("users")

    const { data } = await supabase.from(usersTable).select("*").limit(100)

    return data
}
```

### API Route Authentication

```typescript
import { getUserAndOrgFromToken } from "@hubble/auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
    try {
        // Extract token from Authorization header
        const authHeader = request.headers.get("authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return Response.json(
                { error: "Missing or invalid authorization header" },
                { status: 401 },
            )
        }

        const token = authHeader.replace("Bearer ", "")
        const { userId, orgId } = await getUserAndOrgFromToken(token)

        // Process request with user and org context
        const data = await processRequest(userId, orgId)

        return Response.json({ success: true, data })
    } catch (error) {
        return Response.json({ error: "Authentication failed" }, { status: 401 })
    }
}
```

### Middleware Integration

```typescript
import { getCurrentOrgId } from "@hubble/auth"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
    // Check if route requires authentication
    if (request.nextUrl.pathname.startsWith("/api/protected")) {
        try {
            const orgId = await getCurrentOrgId()
            if (!orgId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }

            // Add org context to request headers
            const requestHeaders = new Headers(request.headers)
            requestHeaders.set("x-org-id", orgId)

            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            })
        } catch (error) {
            return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
        }
    }

    return NextResponse.next()
}
```

## Configuration

### Environment Variables

The package requires the following environment variables:

```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Environment (optional, defaults to 'production')
NODE_ENV=development
```

### Clerk Setup

1. **Create Clerk Application**

- Go to [clerk.com](https://clerk.com)
- Create a new application
- Configure organization settings

2. **Configure Environment Variables**

- Add Clerk keys to your environment
- Set up proper redirect URLs

3. **Database Schema**

- Ensure Clerk schema is set up in Supabase
- Run necessary migrations

## TypeScript Types

### ClerkUser

```typescript
interface ClerkUser {
    id: string
    email: string
    firstName?: string
    lastName?: string
    createdAt: Date
    updatedAt: Date
}
```

### ClerkOrganization

```typescript
interface ClerkOrganization {
    id: string
    name: string
    slug: string
    createdAt: Date
    updatedAt: Date
}
```

### JWTClaims

```typescript
interface JWTClaims {
    sub: string
    org_id: string
    iat: number
    exp: number
    [key: string]: any
}
```

## Error Handling

### Common Errors

```typescript
import { AppError } from "@hubble/core"

// User not found
if (!userId) {
    throw new AppError("User not found", {
        code: "USER_NOT_FOUND",
        statusCode: 404,
    })
}

// Organization not found
if (!orgId) {
    throw new AppError("Organization not found", {
        code: "ORG_NOT_FOUND",
        statusCode: 404,
    })
}

// Invalid token
if (!token) {
    throw new AppError("Invalid authentication token", {
        code: "INVALID_TOKEN",
        statusCode: 401,
    })
}
```

### Error Handling Pattern

```typescript
import { getUserAndOrgFromToken } from "@hubble/auth"
import { AppError } from "@hubble/core"

async function authenticateUser(token: string) {
    try {
        const { userId, orgId } = await getUserAndOrgFromToken(token)
        return { userId, orgId }
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        throw new AppError("Authentication failed", {
            code: "AUTH_ERROR",
            statusCode: 401,
            originalError: error,
        })
    }
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from "vitest"
import { getOrgId, getUserAndOrgFromToken } from "@hubble/auth"

describe("@hubble/auth", () => {
    describe("getOrgId", () => {
        it("should return org ID for valid user", async () => {
            const orgId = await getOrgId("user_123")
            expect(orgId).toBe("org_abc123")
        })

        it("should return null for invalid user", async () => {
            const orgId = await getOrgId("invalid_user")
            expect(orgId).toBeNull()
        })
    })

    describe("getUserAndOrgFromToken", () => {
        it("should extract user and org from valid token", async () => {
            const mockToken = "valid.jwt.token"
            const result = await getUserAndOrgFromToken(mockToken)

            expect(result).toHaveProperty("userId")
            expect(result).toHaveProperty("orgId")
            expect(result).toHaveProperty("user")
            expect(result).toHaveProperty("org")
        })

        it("should throw error for invalid token", async () => {
            const invalidToken = "invalid.token"

            await expect(getUserAndOrgFromToken(invalidToken)).rejects.toThrow("Invalid token")
        })
    })
})
```

### Integration Tests

```typescript
import { describe, it, expect } from "vitest"
import { getCurrentOrgId } from "@hubble/auth"

describe("Auth Integration", () => {
    it("should work with Clerk authentication", async () => {
        // Mock Clerk authentication
        const orgId = await getCurrentOrgId()
        expect(orgId).toBeDefined()
    })
})
```

## Security Considerations

### JWT Token Security

1. **Token Validation**: Always validate JWT tokens before processing
2. **Expiration**: Check token expiration times
3. **Signature Verification**: Verify token signatures
4. **Claims Validation**: Validate required claims

### Organization Isolation

1. **Multi-tenant Data**: Ensure data is properly scoped to organizations
2. **RLS Policies**: Use Row Level Security for database access
3. **Context Validation**: Always validate organization context

### Best Practices

1. **Never Trust Client Data**: Always validate data server-side
2. **Use HTTPS**: Ensure all communication is encrypted
3. **Token Storage**: Store tokens securely (httpOnly cookies)
4. **Regular Rotation**: Rotate secrets regularly

## Migration Guide

### From v0.x to v1.x

1. **Function Names**: Update function imports
2. **Error Handling**: Use new error classes
3. **Type Definitions**: Update type imports

```typescript
// Before (v0.x)
import { getOrganizationId, parseToken } from "@hubble/auth"

// After (v1.x)
import { getOrgId, getUserAndOrgFromToken } from "@hubble/auth"
```

## Performance Considerations

- **Caching**: Organization data is cached for performance
- **Token Validation**: JWT validation is optimized
- **Database Queries**: Minimal database queries for auth operations

## Troubleshooting

### Common Issues

1. **Token Validation Errors**

- Check Clerk configuration
- Verify JWT secret keys
- Ensure proper token format

2. **Organization Not Found**

- Verify user is in organization
- Check Clerk organization setup
- Validate database schema

3. **Permission Errors**

- Check RLS policies
- Verify organization context
- Validate user permissions

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
CLERK_DEBUG=true
```

## Contributing

When contributing to `@hubble/auth`:

1. **Security First**: Ensure all changes maintain security
2. **Test Coverage**: Add comprehensive tests
3. **Documentation**: Update documentation for changes
4. **Error Handling**: Implement proper error handling

## Related Packages

- [**@hubble/core**](../core/README.md) - Core utilities and error handling
- [**@hubble/db**](../db/README.md) - Database client factories
- [**@hubble/types**](../types/README.md) - Shared TypeScript types
