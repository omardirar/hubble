# EventBus Evaluation

## Current Implementation Analysis

The current `AgentEventBus` is a custom implementation with the following features:

### Features

- **Type-safe events**: Uses TypeScript discriminated unions for `AgentEvent` type
- **Async listener support**: Handles both sync and async listeners
- **Error handling**: Built-in error handling for listener failures
- **Simple API**: `emit()`, `subscribe()`, `clear()` methods
- **Memory management**: Uses `Set` for listeners with automatic cleanup

### Current Usage

- Used in `ChatAgentRuntime` for agent lifecycle events
- Used in `AgentStore` for state change notifications
- Emits structured events like `agent/run-started`, `agent/tool-finished`, etc.
- Supports both sync and async event handlers

## Standard Library Alternatives

### 1. Node.js EventEmitter

```typescript
import { EventEmitter } from "events"

class AgentEventBus extends EventEmitter {
  emit(event: AgentEvent): void {
    super.emit(event.type, event)
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.on("*", listener)
    return () => this.off("*", listener)
  }
}
```

**Pros:**

- Battle-tested and widely used
- Built into Node.js (no dependencies)
- Rich API with `once()`, `prependListener()`, etc.
- Memory leak protection with `setMaxListeners()`
- Event names as strings (flexible)

**Cons:**

- String-based event names (less type-safe)
- No built-in async support
- More complex API than needed
- Requires wrapper for type safety

### 2. Mitt (Tiny Event Emitter)

```typescript
import mitt, { Emitter } from "mitt"

type Events = {
  "agent/run-started": AgentEvent
  "agent/run-finished": AgentEvent
  // ... other events
}

const eventBus: Emitter<Events> = mitt<Events>()
```

**Pros:**

- Very lightweight (200 bytes)
- TypeScript support
- Simple API
- No dependencies

**Cons:**

- No async support
- No error handling
- Less feature-rich than EventEmitter

### 3. EventTarget (Web Standard)

```typescript
class AgentEventBus extends EventTarget {
  emit(event: AgentEvent): void {
    this.dispatchEvent(new CustomEvent(event.type, { detail: event }))
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    const handler = (e: CustomEvent) => listener(e.detail)
    this.addEventListener("*", handler)
    return () => this.removeEventListener("*", handler)
  }
}
```

**Pros:**

- Web standard (works in browsers)
- Built into modern JavaScript
- Type-safe with CustomEvent

**Cons:**

- No async support
- More complex for our use case
- Requires wrapper for type safety

## Recommendation

### Keep Custom EventBus

**Reasons:**

1. **Type Safety**: The current implementation provides excellent type safety with discriminated unions
2. **Async Support**: Built-in support for async listeners with proper error handling
3. **Simplicity**: Clean, focused API that matches our exact needs
4. **Performance**: Lightweight implementation without unnecessary features
5. **Error Handling**: Built-in error handling prevents listener failures from crashing the system
6. **Memory Management**: Simple cleanup with `Set` and unsubscribe functions

### Current Implementation Strengths

1. **Type-Safe Events**:

   ```typescript
   type AgentEvent =
     | { type: "agent/run-started"; run: AgentRunState }
     | { type: "agent/tool-finished"; runId: string; invocation: AgentToolInvocationState }
   ```

2. **Async Listener Support**:

   ```typescript
   // Handles both sync and async listeners
   const result = listener(event)
   if (result && typeof result === "object" && "then" in result) {
     void (result as Promise<void>).catch((error) => {
       this.onError?.(error, event)
     })
   }
   ```

3. **Error Isolation**: Listener failures don't crash the event system

4. **Clean API**: Simple, focused methods that match the use case

### Potential Improvements

If we were to enhance the current implementation, we could add:

1. **Event Filtering**: Filter events by type
2. **Once Listeners**: Listen to an event only once
3. **Priority Support**: Order listeners by priority
4. **Batch Emission**: Emit multiple events at once

But these are not needed for the current use case.

## Conclusion

The custom `AgentEventBus` is well-suited for this project because:

- It provides the exact functionality needed
- It's type-safe and performant
- It handles async operations correctly
- It's simple and maintainable
- It doesn't introduce unnecessary dependencies

**Recommendation: Keep the custom EventBus implementation.**

The current implementation is appropriate for the project's needs and provides better type safety and async support than standard alternatives.
