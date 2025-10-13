# Chat Feature Architecture

## Overview

The chat feature is built with a layered architecture that separates concerns and provides robust error handling, type safety, and performance optimizations.

## Architecture Layers

### 1. UI Layer (`apps/dashboard/src/app/(protected)/chat/`)

**Components:**

- `ChatPage` - Main chat interface with conversation management
- `MessagePartRenderer` - Renders different types of message parts (tools, reasoning, etc.)

**Key Features:**

- Error boundaries for crash protection
- Loading and empty states
- Optimistic updates for immediate feedback
- Memoized message transformations for performance

### 2. Hooks Layer (`packages/chat/src/hooks/`)

**Custom Hooks:**

- `useConversationManager` - State machine for conversation creation and message sending
- `useConversationMessages` - Message loading with caching and error handling
- `useChatSidebar` - Sidebar state management

**Benefits:**

- Encapsulates complex state logic
- Provides consistent error handling
- Enables easy testing and reuse

### 3. Services Layer (`packages/chat/src/services/`)

**Architecture:**

- `ChatRepository` - Data access layer (CRUD operations)
- `ChatOperations` - Business logic layer (validation, orchestration)
- `ChatService` - Legacy compatibility layer (deprecated)

**Separation of Concerns:**

- Repository handles API calls and caching
- Operations handle business rules and validation
- Service provides backward compatibility

### 4. Utilities Layer (`packages/chat/src/utils/`)

**Utilities:**

- `type-guards.ts` - Type-safe validation functions
- `error-handling.ts` - Centralized error classification and handling
- `request-cache.ts` - Request deduplication and caching
- `retry-logic.ts` - Retry functionality with exponential backoff
- `message-utils.ts` - Message transformation utilities

## Error Handling Strategy

### Error Classification

The system classifies errors into categories for appropriate handling:

```typescript
enum ChatErrorType {
  NETWORK = "network",
  AUTHENTICATION = "authentication",
  VALIDATION = "validation",
  RATE_LIMIT = "rate_limit",
  SERVER = "server",
  UNKNOWN = "unknown",
}
```

### Error Flow

1. **Error Occurs** - API call fails or validation error
2. **Classification** - Error is classified by type
3. **User Feedback** - Appropriate message shown to user
4. **Logging** - Error logged with context for debugging
5. **Recovery** - Retry options provided where appropriate

### Error Recovery

- **Network Errors**: Automatic retry with exponential backoff
- **Authentication Errors**: Redirect to sign-in
- **Validation Errors**: Show specific field errors
- **Rate Limit Errors**: Show wait time and retry option
- **Server Errors**: Show generic message with retry option

## State Management

### Conversation State Machine

The conversation manager uses a state machine to handle complex flows:

```typescript
type ConversationState =
  | { status: "idle" }
  | { status: "creating"; input: string }
  | { status: "sending"; conversationId: string; input: string }
  | { status: "error"; error: string }
```

**Benefits:**

- Prevents race conditions
- Clear state transitions
- Easy to debug and test
- Prevents invalid state combinations

### Message State

Messages are managed with:

- Optimistic updates for immediate feedback
- Proper cleanup on component unmount
- Abort signal support for cancellation
- Type-safe transformations

## Performance Optimizations

### Request Caching

- **Messages**: 2-minute TTL cache
- **Conversations**: 5-minute TTL cache
- **Deduplication**: Prevents duplicate requests
- **Invalidation**: Smart cache invalidation on updates

### React Optimizations

- **Memoization**: Message transformations memoized
- **Callback Stability**: useCallback for stable references
- **Effect Dependencies**: Proper dependency arrays
- **Component Splitting**: Extracted complex rendering logic

### Type Safety

- **Type Guards**: Runtime type validation
- **Schema Validation**: Zod schemas for API contracts
- **Strict Types**: No `any` types, proper null checks
- **Error Types**: Typed error handling

## Data Flow

### Message Sending Flow

1. **User Input** → `handleSubmit`
2. **Optimistic Update** → Add message to UI immediately
3. **State Machine** → `useConversationManager.sendMessage`
4. **API Call** → `ChatOperations.sendMessage`
5. **Repository** → `ChatRepository.sendMessage`
6. **Response** → Update UI with actual response
7. **Error Handling** → Show error if failed, store for retry

### Message Loading Flow

1. **Conversation Change** → `useConversationMessages.loadMessages`
2. **Cache Check** → Check if messages are cached
3. **API Call** → Load from API if not cached
4. **Type Transformation** → Convert to UI message format
5. **State Update** → Update messages state
6. **Error Handling** → Show error if failed

## Testing Strategy

### Unit Tests

- **Hooks**: Test state transitions and side effects
- **Utilities**: Test type guards and error handling
- **Services**: Test business logic and API calls

### Integration Tests

- **Message Flow**: End-to-end message sending
- **Error Scenarios**: Test error handling paths
- **Cache Behavior**: Test caching and invalidation

### E2E Tests

- **User Workflows**: Complete conversation flows
- **Error Recovery**: Test retry and error states
- **Performance**: Test with large message lists

## Security Considerations

### Authentication

- All API calls include authentication headers
- Conversation access is verified before operations
- User context is properly scoped

### Data Validation

- Input validation on all user inputs
- Schema validation for API responses
- Sanitization of user-generated content

### Error Information

- No sensitive data in error messages
- Proper error logging without data exposure
- User-friendly error messages

## Monitoring and Observability

### Logging

- Structured logging with context
- Error tracking with stack traces
- Performance metrics for API calls

### Metrics

- Message send success rate
- Error rates by category
- Cache hit rates
- User interaction patterns

### Debugging

- Error boundaries for crash protection
- Detailed error context in logs
- State machine transitions logged

## Future Improvements

### Planned Enhancements

1. **Real-time Updates** - WebSocket support for live messages
2. **Message Search** - Full-text search across conversations
3. **Message Threading** - Reply-to functionality
4. **File Attachments** - Support for file uploads
5. **Message Reactions** - Emoji reactions to messages

### Technical Debt

1. **Legacy Service** - Remove deprecated ChatService
2. **Type Improvements** - Stricter TypeScript configuration
3. **Test Coverage** - Increase test coverage to 90%+
4. **Performance** - Virtual scrolling for large message lists

## Migration Guide

### From Legacy ChatService

```typescript
// Old way
const response = await ChatService.sendMessage(text, history)

// New way
const response = await ChatOperations.sendMessage(text, history)
```

### Error Handling Migration

```typescript
// Old way
try {
  await someOperation()
} catch (error) {
  toast.error("Something went wrong")
}

// New way
try {
  await someOperation()
} catch (error) {
  handleChatError(error, { context: { operation: "some_operation" } })
}
```

### Type Safety Migration

```typescript
// Old way
const role = message.role as "user" | "assistant"

// New way
const role = isValidMessageRole(message.role) ? message.role : "user"
```

## Troubleshooting

### Common Issues

1. **Infinite Re-renders**: Check useEffect dependencies
2. **Memory Leaks**: Ensure proper cleanup in useEffect
3. **Race Conditions**: Use the conversation manager state machine
4. **Type Errors**: Use type guards instead of assertions
5. **Cache Issues**: Check cache invalidation logic

### Debug Tools

1. **React DevTools**: Inspect component state
2. **Network Tab**: Check API calls and responses
3. **Console Logs**: Check structured logging output
4. **Error Boundaries**: Check error boundary fallbacks

### Performance Issues

1. **Slow Rendering**: Check memoization of expensive operations
2. **Memory Usage**: Check for memory leaks in effects
3. **API Calls**: Check for duplicate or unnecessary requests
4. **Bundle Size**: Check for unused imports and code
