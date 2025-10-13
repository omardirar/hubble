# Modules Documentation

This directory contains detailed documentation for individual modules and components within the Hubble platform.

## Overview

The Hubble platform is organized into distinct modules, each with specific responsibilities and well-defined interfaces. This documentation provides comprehensive information about each module's purpose, implementation, and usage.

## Module Architecture

```mermaid
graph TB
  subgraph "Core Modules"
      A[Authentication Module]
      B[Database Module]
      C[Error Handling Module]
      D[Logging Module]
  end

  subgraph "Feature Modules"
      E[Chat Module]
      F[Connect Module]
      G[Analytics Module]
      H[User Management Module]
  end

  subgraph "Infrastructure Modules"
      I[API Module]
      J[Queue Module]
      K[Cache Module]
      L[External Services Module]
  end

  subgraph "UI Modules"
      M[Component Library]
      N[Theme Module]
      O[Layout Module]
      P[Form Module]
  end
```

## Available Modules

The table below links each core module to its authoritative documentation. Most module-level references live in `docs/packages/*.md` because functionality is shared via workspaces.

| Module                        | Repository Location                    | Documentation                                                          |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Authentication                | `packages/auth/`                       | `docs/packages/auth.md`                                                |
| Core Utilities                | `packages/core/`                       | `docs/packages/core.md`                                                |
| Database                      | `packages/db/`                         | `docs/packages/db.md`                                                  |
| Chat                          | `packages/chat/`                       | `docs/packages/chat.md`                                                |
| Connect                       | `packages/connect/`                    | `docs/packages/connect.md`                                             |
| Infrastructure (QStash/Redis) | `packages/infrastructure/`             | `docs/packages/infrastructure.md`                                      |
| Logger & Observability        | `packages/logger/`                     | `docs/packages/logger.md`                                              |
| UI Components                 | `packages/ui/`                         | `docs/packages/ui.md`                                                  |
| Type Definitions              | `packages/types/`, `packages/schemas/` | `docs/packages/types.md`, `docs/packages/schemas.md`                   |
| Server & Agent Runtime        | `packages/server/`                     | `docs/packages/server.md`                                              |
| Agent Backend (Python)        | `services/agents/`                     | `services/agents/README.md`, `services/agents/docs/RESPONSE_SCHEMA.md` |
| MCP Servers                   | `services/mcp/`                        | `docs/mcp/architecture.md`, `docs/mcp/motherduck.md`                   |

### Feature Architecture Notes

- [**Chat Architecture**](../packages/chat-architecture.md) covers the real-time conversation loop, including streaming, optimistic updates, and persistence.
- [**Server Architecture**](../packages/server-architecture.md) explains orchestration, tool routing, and event streaming.
- [**Event Bus Evaluation**](../packages/event-bus-evaluation.md) captures trade-offs considered for queueing and messaging.

## Module Development

### Creating a New Module

1. **Define Module Purpose**: Clearly define what the module does
2. **Create Module Structure**: Set up the directory structure
3. **Implement Core Functionality**: Build the main features
4. **Add Tests**: Write comprehensive tests
5. **Document Module**: Create detailed documentation
6. **Export Public API**: Define the public interface

### Module Structure Template

```text
packages/module-name/
├── src/
│   ├── index.ts              # Main export file
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   ├── services/             # Business logic
│   ├── components/           # React components (if applicable)
│   └── __tests__/            # Test files
├── package.json              # Package configuration
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Module documentation
└── CHANGELOG.md              # Change log
```

### Module Guidelines

#### Naming Conventions

- **Package Name**: `@hubble/module-name`
- **Directory Name**: `module-name` (kebab-case)
- **Export Names**: Use descriptive, clear names
- **File Names**: Use kebab-case for files

#### Dependencies

- **Minimal Dependencies**: Only include necessary dependencies
- **Peer Dependencies**: Use for major frameworks
- **Internal Dependencies**: Use workspace packages when possible
- **Version Management**: Keep dependencies up to date

#### API Design

- **Consistent Interface**: Follow established patterns
- **Type Safety**: Use TypeScript for all APIs
- **Error Handling**: Implement proper error handling
- **Documentation**: Document all public APIs

#### Testing

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test module interactions
- **Coverage**: Maintain high test coverage
- **Performance Tests**: Test performance characteristics

## Module Integration

### Inter-Module Communication

#### Direct Imports

```typescript
// Direct import for simple dependencies
import { generateId } from "@hubble/core"
import { createClient } from "@hubble/db"
```

#### Service Injection

```typescript
// Service injection for complex dependencies
interface ChatService {
  createConversation(data: CreateConversationData): Promise<Conversation>
}

class ChatModule {
  constructor(private chatService: ChatService) {}
}
```

#### Event-Driven Communication

```typescript
// Event-driven communication for loose coupling
import { EventBus } from "@hubble/core"

class ChatModule {
  constructor(private eventBus: EventBus) {
    this.eventBus.on("user.created", this.handleUserCreated.bind(this))
  }
}
```

### Module Dependencies

#### Dependency Graph

```mermaid
graph TD
  A[UI Module] --> B[Chat Module]
  A --> C[Connect Module]
  A --> D[User Management Module]

  B --> E[Database Module]
  B --> F[Authentication Module]
  B --> G[External Services Module]

  C --> E
  C --> F
  C --> H[Queue Module]

  D --> E
  D --> F

  E --> I[Core Module]
  F --> I
  G --> I
  H --> I
```

#### Circular Dependencies

- **Avoid Circular Dependencies**: Design modules to avoid circular imports
- **Use Events**: Use event-driven communication for circular dependencies
- **Extract Common Code**: Move shared code to common modules
- **Dependency Injection**: Use dependency injection to break cycles

## Module Testing

### Testing Strategy

#### Unit Testing

```typescript
// Test individual module functions
import { generateId } from "@hubble/core"

describe("Core Module", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })
})
```

#### Integration Testing

```typescript
// Test module interactions
import { ChatModule } from "@hubble/chat"
import { DatabaseModule } from "@hubble/db"

describe("Chat Module Integration", () => {
  it("should create conversation in database", async () => {
    const db = new DatabaseModule()
    const chat = new ChatModule(db)

    const conversation = await chat.createConversation({
      title: "Test Conversation",
    })

    expect(conversation.id).toBeDefined()
  })
})
```

#### Mocking Dependencies

```typescript
// Mock external dependencies
import { vi } from "vitest"

const mockDatabase = {
  createConversation: vi.fn(),
  getConversations: vi.fn(),
}

const chatModule = new ChatModule(mockDatabase)
```

## Module Documentation

### Documentation Standards

#### README Structure

1. **Overview**: What the module does
2. **Installation**: How to install and use
3. **API Reference**: Complete API documentation
4. **Examples**: Usage examples
5. **Configuration**: Configuration options
6. **Testing**: How to test the module
7. **Contributing**: How to contribute

#### Code Documentation

````typescript
/**
 * Creates a new conversation in the database
 * @param data - Conversation creation data
 * @param data.title - Conversation title
 * @param data.model - AI model to use
 * @param data.systemPrompt - Optional system prompt
 * @returns Promise resolving to created conversation
 * @throws {ValidationError} When input data is invalid
 * @throws {DatabaseError} When database operation fails
 * @example
 * ```typescript
 * const conversation = await createConversation({
 *   title: 'Marketing Strategy',
 *   model: 'claude-3-sonnet'
 * })
 * ```
 */
export async function createConversation(data: CreateConversationData): Promise<Conversation> {
  // Implementation
}
````

## Module Maintenance

### Version Management

#### Semantic Versioning

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

#### Changelog

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added

- New conversation export feature
- Support for custom AI models

### Changed

- Updated conversation API response format
- Improved error handling

### Fixed

- Fixed conversation title generation bug
- Resolved memory leak in message handling

## [1.1.0] - 2024-01-01

### Added

- Initial release
- Basic conversation management
- Message handling
```

### Deprecation Management

#### Deprecation Process

1. **Mark as Deprecated**: Add deprecation warnings
2. **Document Migration**: Provide migration guides
3. **Maintain Compatibility**: Keep deprecated features working
4. **Remove in Next Major**: Remove in next major version

#### Deprecation Example

```typescript
/**
 * @deprecated Use createConversation instead
 * @see createConversation
 */
export function createChat(data: ChatData): Promise<Chat> {
  console.warn("createChat is deprecated, use createConversation instead")
  return createConversation(data)
}
```

## Related Documentation

- [Architecture Guide](../architecture.md)
- [Setup Guide](../setup.md)
- [API Documentation](../apps/dashboard/api.md)
- [Package Documentation](../packages/overview.md)
- [Testing Documentation](../tests/README.md)
