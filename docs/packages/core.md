# @hubble/core

Core utilities, error handling, and common functions for the Hubble platform.

## Overview

The `@hubble/core` package provides fundamental utilities and error handling that are used across all other packages in the Hubble ecosystem. It includes common functions, error classes, and utility types that form the foundation of the platform.

## Installation

```bash
pnpm add @hubble/core
```

## Exports

### Utility Functions

#### `cn(...inputs)`

Tailwind class name merger utility.

```typescript
import { cn } from "@hubble/core"

const className = cn("base-class", condition && "conditional-class", { active: isActive })
// Result: 'base-class conditional-class active'
```

#### `generateId(prefix?)`

Generate unique IDs with optional prefix.

```typescript
import { generateId } from "@hubble/core"

const id = generateId() // 'id_abc123'
const prefixedId = generateId("user") // 'user_abc123'
```

#### `safeFetch(url, options)`

Fetch wrapper with error handling and retry logic.

```typescript
import { safeFetch } from "@hubble/core"

const response = await safeFetch("https://api.example.com/data", {
  method: "GET",
  headers: { Authorization: "Bearer token" },
})

if (response.success) {
  console.log(response.data)
} else {
  console.error(response.error)
}
```

### Error Classes

#### `AppError`

Base error class for application errors.

```typescript
import { AppError } from "@hubble/core"

throw new AppError("Something went wrong", {
  code: "CUSTOM_ERROR",
  statusCode: 400,
})
```

#### `DatabaseError`

Database operation errors.

```typescript
import { DatabaseError } from "@hubble/core"

throw new DatabaseError("Failed to connect to database", {
  operation: "connect",
  table: "users",
})
```

#### `ValidationError`

Data validation errors.

```typescript
import { ValidationError } from "@hubble/core"

throw new ValidationError("Invalid input data", {
  field: "email",
  value: "invalid-email",
  rule: "email_format",
})
```

#### `AuthenticationError`

Authentication and authorization errors.

```typescript
import { AuthenticationError } from "@hubble/core"

throw new AuthenticationError("Invalid credentials", {
  userId: "user_123",
  action: "login",
})
```

#### `RateLimitError`

Rate limiting errors.

```typescript
import { RateLimitError } from "@hubble/core"

throw new RateLimitError("Rate limit exceeded", {
  limit: 100,
  window: "1m",
  retryAfter: 60,
})
```

### Error Codes

Standardized error codes used across the platform.

```typescript
import { ApiErrorCodes } from "@hubble/core"

// Available error codes
ApiErrorCodes.UNAUTHORIZED // 'UNAUTHORIZED'
ApiErrorCodes.FORBIDDEN // 'FORBIDDEN'
ApiErrorCodes.NOT_FOUND // 'NOT_FOUND'
ApiErrorCodes.VALIDATION_ERROR // 'VALIDATION_ERROR'
ApiErrorCodes.RATE_LIMITED // 'RATE_LIMITED'
ApiErrorCodes.INTERNAL_ERROR // 'INTERNAL_ERROR'
ApiErrorCodes.DATABASE_ERROR // 'DATABASE_ERROR'
ApiErrorCodes.NETWORK_ERROR // 'NETWORK_ERROR'
ApiErrorCodes.TIMEOUT_ERROR // 'TIMEOUT_ERROR'
```

### Utility Types

#### `Optional<T, K>`

Make specific keys optional in a type.

```typescript
import { Optional } from "@hubble/core"

interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

type CreateUser = Optional<User, "id" | "createdAt">
// { name: string; email: string; id?: string; createdAt?: Date }
```

#### `RequiredFields<T, K>`

Make specific keys required in a type.

```typescript
import { RequiredFields } from "@hubble/core"

interface PartialUser {
  id?: string
  name?: string
  email?: string
}

type UserWithId = RequiredFields<PartialUser, "id">
// { id: string; name?: string; email?: string }
```

#### `BaseEntity`

Base interface for all database entities.

```typescript
import { BaseEntity } from "@hubble/core"

interface User extends BaseEntity {
  name: string
  email: string
}
// { id: string; created_at: Date; updated_at: Date; name: string; email: string }
```

#### `ApiResponse<T>`

Standard API response format.

```typescript
import { ApiResponse } from "@hubble/core"

type UserResponse = ApiResponse<User>
// { success: boolean; data?: User; error?: ApiError }
```

#### `PaginatedResponse<T>`

Paginated API response format.

```typescript
import { PaginatedResponse } from "@hubble/core"

type UsersResponse = PaginatedResponse<User>
// { success: boolean; data: User[]; pagination: PaginationInfo; error?: ApiError }
```

### Constants

#### `HTTP_STATUS_CODES`

Standard HTTP status codes.

```typescript
import { HTTP_STATUS_CODES } from "@hubble/core"

HTTP_STATUS_CODES.OK // 200
HTTP_STATUS_CODES.CREATED // 201
HTTP_STATUS_CODES.BAD_REQUEST // 400
HTTP_STATUS_CODES.UNAUTHORIZED // 401
HTTP_STATUS_CODES.FORBIDDEN // 403
HTTP_STATUS_CODES.NOT_FOUND // 404
HTTP_STATUS_CODES.INTERNAL_ERROR // 500
```

#### `DEFAULT_PAGINATION`

Default pagination settings.

```typescript
import { DEFAULT_PAGINATION } from "@hubble/core"

DEFAULT_PAGINATION.limit // 20
DEFAULT_PAGINATION.offset // 0
DEFAULT_PAGINATION.maxLimit // 100
```

## Usage Examples

### Error Handling

```typescript
import { AppError, DatabaseError, ValidationError, ApiErrorCodes } from "@hubble/core"

async function createUser(userData: CreateUserData) {
  try {
    // Validate input
    if (!userData.email) {
      throw new ValidationError("Email is required", {
        field: "email",
        code: ApiErrorCodes.VALIDATION_ERROR,
      })
    }

    // Database operation
    const user = await db.users.create(userData)
    return user
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error // Re-throw validation errors
    }

    throw new DatabaseError("Failed to create user", {
      operation: "create",
      table: "users",
      originalError: error,
    })
  }
}
```

### API Response Formatting

```typescript
import { ApiResponse, AppError } from "@hubble/core"

export function createApiResponse<T>(data: T, success: boolean = true): ApiResponse<T> {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : (data as any),
  }
}

export function createErrorResponse(error: AppError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  }
}
```

### Utility Examples

```typescript
import { cn, generateId, safeFetch } from "@hubble/core"

// Class name merging
const buttonClass = cn(
  "px-4 py-2 rounded",
  variant === "primary" && "bg-blue-500 text-white",
  disabled && "opacity-50 cursor-not-allowed",
)

// ID generation
const conversationId = generateId("conv")
const messageId = generateId("msg")

// Safe fetch with error handling
const fetchUserData = async (userId: string) => {
  const response = await safeFetch(`/api/users/${userId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.success) {
    throw new AppError("Failed to fetch user data", {
      code: "FETCH_ERROR",
      details: response.error,
    })
  }

  return response.data
}
```

## TypeScript Configuration

The package includes TypeScript definitions and should work with strict mode enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Error Handling Patterns

### Custom Error Classes

```typescript
import { AppError } from "@hubble/core"

class CustomBusinessError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: "BUSINESS_ERROR",
      statusCode: 400,
      ...details,
    })
  }
}
```

### Error Boundaries (React)

```typescript
import { AppError } from '@hubble/core'

class ErrorBoundary extends React.Component {
  constructor(props) {
  super(props)
  this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
  if (error instanceof AppError) {
    return { hasError: true, error }
  }
  return { hasError: true, error: new AppError('Unknown error') }
  }

  render() {
  if (this.state.hasError) {
    return <ErrorFallback error={this.state.error} />
  }
  return this.props.children
  }
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from "vitest"
import { cn, generateId, AppError } from "@hubble/core"

describe("@hubble/core", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("base", "additional")).toBe("base additional")
      expect(cn("base", { active: true })).toBe("base active")
      expect(cn("base", { active: false })).toBe("base")
    })
  })

  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^id_/)
    })

    it("should include prefix when provided", () => {
      const id = generateId("user")
      expect(id).toMatch(/^user_/)
    })
  })

  describe("AppError", () => {
    it("should create error with correct properties", () => {
      const error = new AppError("Test error", { code: "TEST_ERROR" })
      expect(error.message).toBe("Test error")
      expect(error.code).toBe("TEST_ERROR")
      expect(error.name).toBe("AppError")
    })
  })
})
```

## Performance Considerations

- **Tree Shaking**: All exports are designed to support tree shaking
- **Bundle Size**: Minimal dependencies to keep bundle size small
- **Error Objects**: Error classes are lightweight and don't include heavy dependencies

## Migration Guide

### From v0.x to v1.x

1. **Error Classes**: Update error handling to use new error classes
2. **Utility Functions**: Update function imports and usage
3. **Type Definitions**: Update type imports and usage

```typescript
// Before (v0.x)
import { mergeClasses, createId } from "@hubble/core"

// After (v1.x)
import { cn, generateId } from "@hubble/core"
```

## Contributing

When contributing to `@hubble/core`:

1. **Follow Patterns**: Maintain consistency with existing code
2. **Add Tests**: Include comprehensive tests for new functionality
3. **Update Types**: Ensure TypeScript types are accurate
4. **Document Changes**: Update this documentation for new features

## Related Packages

- [**@hubble/types**](../types.md) - Shared TypeScript types
- [**@hubble/schemas**](../schemas.md) - Zod validation schemas
- [**@hubble/logger**](../logger.md) - Structured logging
