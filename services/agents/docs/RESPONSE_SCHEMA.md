# Agent Response Schema v1.3+

This document describes the comprehensive agent response schema v1.3+ that aligns with PydanticAI best practices, Anthropic thinking features, and Model Context Protocol (MCP) standards.

## Overview

The v1.3+ schema provides:

- **Raw message storage** using binary-safe bytes format (`new_messages_json()`)
- **Finished-only events** (no deltas, aggregated via `event_stream_handler`)
- **MCP session lifecycle tracking** with protocol versions
- **Comprehensive token accounting** (reasoning and cache tokens kept separate)
- **UUID4 run identifiers** with optional URN rendering
- **Optional retry, provenance, and policy fields** for compliance & debugging

## Schema Structure

### Core Components

```json
{
  "schema_version": "1.3",
  "conversation": { "conversation_id": "string", "org_id": "string", "user_id": "string" },
  "request": { "timestamp": "datetime", "user_message": "string", "requested_by": "string" },
  "run": { "id": "uuid4", "status": "string", "started_at": "datetime", "completed_at": "datetime", ... },
  "agents": [{ "name": "string", "role": "string", "model": {...}, "model_settings": {...} }],
  "routing": { "decider": "string", "reason": "string", "confidence": "number", "strategy": "string", "candidates": [...] },
  "output": { "type": "string", "value": "string" },
  "last_model_response": { "timestamp": "datetime", "model_name": "string", "provider_name": "string", ... },
  "usage": { "input_tokens": "number", "output_tokens": "number", "reasoning_tokens": "number", ... },
  "messages": { "format": "string", "encoding": "string", "json": "bytes", "compression": "string" },
  "events": [{ "id": "string", "ts": "datetime", "type": "string", "data": {...} }],
  "mcp": { "servers": [...], "sessions": [...] },
  "policy": { "thinking_visibility": "string", "pii_filter": "boolean", "policy_version": "string" }
}
```

## Field Definitions

### Conversation Context

```typescript
interface ConversationContext {
  conversation_id: string // Unique conversation identifier
  org_id: string // Organization identifier
  user_id: string // User identifier
}
```

### Request Information

```typescript
interface RequestInfo {
  timestamp: datetime // Request timestamp
  user_message: string // User's input message
  requested_by: "user" | "system" | "automation" // Trigger source
}
```

### Run Information

```typescript
interface RunInfo {
  id: uuid4 // Run identifier (UUID4, no URN prefix)
  parent_run_id?: uuid4 // Parent run for sub-workflows
  retry_of?: uuid4 // Previous failed run being retried
  attempt?: number // Retry attempt number (default: 1)
  status: "succeeded" | "failed" | "cancelled" | "timed_out"
  started_at: datetime // Run start time
  completed_at: datetime // Run completion time
  correlation_id?: uuid4 // Cross-service tracing ID
  tags?: string[] // Experiment/AB testing tags
  workflow: WorkflowConfig
}
```

### Agent Configuration

```typescript
interface AgentConfig {
  name: string // Agent name
  role: string // Agent role (supervisor, sub_agent_tool, etc.)
  model: ModelConfig // Model configuration
  model_settings: ModelSettings // Model settings including thinking budget
}

interface ModelConfig {
  provider: string // Model provider (anthropic, openai, etc.)
  name: string // Model name (claude-sonnet-4-20250514, etc.)
}

interface ModelSettings {
  temperature: number // Temperature setting
  max_tokens: number // Maximum tokens
  top_p: number // Top-p setting
  thinking?: {
    // Anthropic thinking configuration
    enabled: boolean
    budget_tokens: number
  }
}
```

### Routing Decision

```typescript
interface RoutingDecision {
  decider: string // Component that made the decision
  reason: string // Human-readable reason
  confidence: number // Confidence score (0.0-1.0)
  strategy?: "rule_based" | "prompt_router" | "tool_router_llm" | "hybrid"
  candidates?: RoutingCandidate[] // Alternative options considered
}

interface RoutingCandidate {
  type: "agent" | "tool" | "mcp_tool"
  target: string // Target identifier
  score: number // Candidate score
  eligible: boolean // Whether candidate was eligible
}
```

### Token Accounting

#### Critical: Reasoning and cache tokens are NEVER folded into base counters

```typescript
interface UsageDetails {
  input_tokens: number // Base input tokens
  output_tokens: number // Base output tokens
  reasoning_tokens: number // Anthropic thinking tokens (separate!)
  cache_write_tokens: number // Prompt cache write tokens (separate!)
  cache_read_tokens: number // Prompt cache read tokens (separate!)
  input_audio_tokens: number // Audio input tokens
  cache_audio_read_tokens: number // Audio cache read tokens
  details: Record<string, any> // Provider-specific details
}

interface RunUsage extends UsageDetails {
  requests: number // Total requests made
  tool_calls: number // Total tool calls made
}
```

**Why separation matters:**

- Cache hits save money (cache_read_tokens cost less than input_tokens)
- Reasoning tokens cost more than regular output tokens
- Accurate cost attribution requires separate tracking
- Provider billing models differ for different token types

### Message Storage

```typescript
interface MessagesEnvelope {
  format: "pydantic_ai.messages" // Message format identifier
  encoding: "utf-8" // Text encoding
  scope: "new_run_only" // Message scope
  compression?: "zstd" // Optional compression algorithm
  json: bytes // Raw message bytes (DB storage)
}
```

**Storage Strategy:**

- **Database**: Store raw bytes (optionally zstd compressed)
- **File Export**: Base64-encoded with compression metadata
- **Rehydration**: Use PydanticAI's `ModelMessagesTypeAdapter`

### Event Types

#### Success Events

- `workflow_start` - Workflow initiated
- `agent_run_started` - Agent execution started
- `thinking_completed` - Thinking phase completed
- `text_completed` - Text generation completed
- `tool_call_completed` - Tool call completed
- `mcp_request_completed` - MCP request completed
- `agent_run_completed` - Agent execution completed
- `workflow_complete` - Workflow completed

#### Failure/Cancellation Events

- `agent_run_failed` - Agent execution failed
- `tool_call_failed` - Tool call failed
- `mcp_request_failed` - MCP request failed
- `workflow_cancelled` - Workflow cancelled
- `workflow_timed_out` - Workflow timed out

#### Event Data Structure

```typescript
interface EventData {
  // Provider provenance (on all model events)
  provider_request_id?: string
  provider_response_id?: string
  model_name?: string
  provider_name?: string

  // Usage per event when available
  usage?: UsageDetails

  // Error information for failed events
  error?: ErrorInfo

  // Large payload handling
  data_uri?: string // External data URI
  sha256?: string // Content hash
  size_bytes?: number // Content size
  media_type?: string // MIME type for preview decisions

  // Tool/MCP-specific fields
  tool_kind?: string
  tool_name?: string
  tool_call_id?: string
  args?: Record<string, any>
  duration_ms?: number

  // Workflow-specific fields
  content?: string // Event content
  tokens?: number // Token count
  result_kind?: string // Result type
  status?: string // Event status
}
```

### MCP Session Tracking

```typescript
interface MCPServer {
  name: string // Server name
  version: string // Server version
  transport: string // Transport type (http, stdio, sse)
  protocol_version?: string // MCP protocol version (e.g., "2024-11-05")
  tools: string[] // Available tools
  tool_schema_version?: string // Tool schema version
}

interface MCPSession {
  session_id: uuid4 // Session identifier
  server: string // Server name
  transport: string // Transport type
  protocol_version?: string // MCP protocol version
  opened_at: datetime // Session open time
  closed_at: datetime // Session close time
  sequence_id_start?: number // First sequence ID
  sequence_id_end?: number // Last sequence ID
}
```

**MCP Lifecycle Tracking:**

- Sessions are tracked from open to close
- Protocol versions enable replay compatibility
- Sequence tracking helps debug reconnects
- Transport information aids troubleshooting

### Policy Configuration

```typescript
interface Policy {
  thinking_visibility: "full" | "hidden" // Whether thinking is visible
  pii_filter: boolean // Whether PII is filtered
  policy_version?: string // Policy version for audits
}
```

## Event Aggregation Strategy

### Stream Processing

The `StreamAggregator` processes PydanticAI's `event_stream_handler` events:

1. **Part Start Events**: Initialize aggregation buffers
2. **Part Delta Events**: Accumulate content with overflow protection
3. **Final Result Events**: Emit completed events with full metadata
4. **Error Events**: Emit failed events with partial content

### Buffer Management

- **Max Buffer Size**: 20,000 characters per event
- **Overflow Handling**: Truncate with `"...[truncated at 20000 chars]"` marker
- **Flush on Failure**: Emit partial content when runs are cancelled

### Non-Streaming Parity

For non-streaming runs, the `StreamAggregator` synthesizes completed events:

- `thinking_completed` if thinking content exists
- `text_completed` if response content exists
- `tool_call_completed` for each tool call

This ensures uniform storage shape regardless of streaming mode.

## Provider Provenance

Every model-produced event includes:

- `provider_request_id` - Provider's request identifier
- `provider_response_id` - Provider's response identifier
- `model_name` - Specific model used
- `provider_name` - Provider (anthropic, openai, etc.)

This enables detailed debugging without jumping to `last_model_response`.

## Compression Support

### Message Compression

- **Algorithm**: zstd (Zstandard)
- **Trigger**: Messages > 1KB
- **Storage**: Raw compressed bytes in database
- **Export**: Base64-encoded with compression metadata

### Compression Metadata

```json
{
  "messages": {
    "encoding": "base64",
    "compression": "zstd",
    "compression_info": {
      "algorithm": "zstd",
      "note": "Messages are base64-encoded zstd-compressed bytes"
    }
  }
}
```

## Privacy & Compliance

### Thinking Visibility

- `"full"` - Thinking content is stored and visible
- `"hidden"` - Thinking content is filtered out

### PII Filtering

- `true` - PII is automatically filtered from responses
- `false` - PII filtering is disabled

### Policy Versioning

Track which policy rules were active during execution for compliance audits.

## Tracing & Tagging

### Correlation ID

Use `correlation_id` for distributed tracing across services.

### Tags

Use `tags` array for experiment tracking and AB testing:

```json
{
  "tags": ["production", "v1.3", "experiment-a"]
}
```

## Indexing Recommendations

### Database Indexes

```sql
-- Conversation history
CREATE INDEX idx_conversation_history ON responses (conversation_id, run.started_at DESC);

-- Failure analysis
CREATE INDEX idx_failure_analysis ON responses (run.status, run.started_at);

-- Event analytics
CREATE INDEX idx_event_analytics ON response_events (type, ts);

-- Cost dashboards
CREATE INDEX idx_usage_analytics ON responses (usage.input_tokens, usage.output_tokens);
```

### Event Queries

```sql
-- Find all thinking events for a run
SELECT * FROM response_events
WHERE run_id = ? AND type = 'thinking_completed';

-- Find failed tool calls
SELECT * FROM response_events
WHERE type = 'tool_call_failed' AND data->>'tool_name' = ?;

-- Analyze routing decisions
SELECT routing->>'strategy', routing->>'confidence'
FROM responses WHERE routing->>'strategy' IS NOT NULL;
```

## JSON Schema Artifact

The schema is available as a checked-in JSON Schema artifact:

- **Location**: `schema/response_schema_v1.3.json`
- **Generation**: Run `python src/utils/make_json_schema.py`
- **Validation**: Use for API validation in downstream services
- **Changes**: Snapshot tests detect breaking changes

## Migration Guide

### From v1.2 to v1.3

1. **Message Storage**: Convert string messages to bytes format
2. **Event Types**: Map old event types to new enum values
3. **Token Separation**: Ensure reasoning/cache tokens are separate
4. **Provider Metadata**: Add provider provenance to all model events
5. **MCP Tracking**: Add session lifecycle tracking
6. **Error Events**: Convert error handling to new event types

### Backward Compatibility

- **No Migration Script**: Old format responses are not converted
- **Schema Version**: Always set to "1.3" for new responses
- **Validation**: Use Pydantic models for strict validation

## Examples

### Complete Response Example

```json
{
  "schema_version": "1.3",
  "conversation": {
    "conversation_id": "conv-123",
    "org_id": "org-456",
    "user_id": "user-789"
  },
  "request": {
    "timestamp": "2024-01-15T10:30:00Z",
    "user_message": "What is content marketing?",
    "requested_by": "user"
  },
  "run": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "succeeded",
    "started_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:30:05Z",
    "correlation_id": "trace-123",
    "tags": ["production", "v1.3"],
    "workflow": {
      "type": "multi_agent",
      "supervisor_agent": "supervisor",
      "sub_agents": [
        { "name": "marketer_agent", "as_tool": true },
        { "name": "analyst_agent", "as_tool": true }
      ]
    }
  },
  "agents": [
    {
      "name": "supervisor",
      "role": "supervisor",
      "model": {
        "provider": "anthropic",
        "name": "claude-sonnet-4-20250514"
      },
      "model_settings": {
        "temperature": 0.2,
        "max_tokens": 1200,
        "top_p": 1.0,
        "thinking": {
          "enabled": true,
          "budget_tokens": 2048
        }
      }
    }
  ],
  "routing": {
    "decider": "supervisor",
    "reason": "Content marketing question",
    "confidence": 0.95,
    "strategy": "prompt_router",
    "candidates": [
      {
        "type": "agent",
        "target": "marketer_agent",
        "score": 0.9,
        "eligible": true
      }
    ]
  },
  "output": {
    "type": "text",
    "value": "Content marketing is a strategic marketing approach..."
  },
  "last_model_response": {
    "timestamp": "2024-01-15T10:30:05Z",
    "model_name": "claude-sonnet-4-20250514",
    "provider_name": "anthropic",
    "finish_reason": "stop",
    "provider_response_id": "resp-123",
    "usage": {
      "input_tokens": 150,
      "output_tokens": 200,
      "reasoning_tokens": 50,
      "cache_write_tokens": 10,
      "cache_read_tokens": 5,
      "input_audio_tokens": 0,
      "cache_audio_read_tokens": 0,
      "details": {
        "anthropic": {
          "anthropic_reasoning_tokens": 50
        }
      }
    }
  },
  "usage": {
    "requests": 1,
    "tool_calls": 2,
    "input_tokens": 150,
    "output_tokens": 200,
    "reasoning_tokens": 50,
    "cache_write_tokens": 10,
    "cache_read_tokens": 5,
    "input_audio_tokens": 0,
    "cache_audio_read_tokens": 0,
    "details": {
      "anthropic": {
        "anthropic_reasoning_tokens": 50
      }
    }
  },
  "messages": {
    "format": "pydantic_ai.messages",
    "encoding": "utf-8",
    "scope": "new_run_only",
    "compression": "zstd",
    "json": "base64-encoded-compressed-bytes"
  },
  "events": [
    {
      "id": "event-1",
      "ts": "2024-01-15T10:30:00Z",
      "source": { "agent": "supervisor" },
      "type": "workflow_start",
      "data": {
        "provider_request_id": "req-123",
        "model_name": "claude-sonnet-4-20250514",
        "provider_name": "anthropic"
      }
    },
    {
      "id": "event-2",
      "ts": "2024-01-15T10:30:01Z",
      "source": { "agent": "supervisor" },
      "type": "thinking_completed",
      "data": {
        "provider_request_id": "req-123",
        "provider_response_id": "resp-123",
        "model_name": "claude-sonnet-4-20250514",
        "provider_name": "anthropic",
        "content": "Let me think about this content marketing question...",
        "tokens": 50,
        "usage": {
          "reasoning_tokens": 50
        }
      }
    }
  ],
  "mcp": {
    "servers": [
      {
        "name": "motherduck",
        "version": "1.0.0",
        "transport": "http",
        "protocol_version": "2024-11-05",
        "tools": ["query", "list_tables"],
        "tool_schema_version": "1.0"
      }
    ],
    "sessions": [
      {
        "session_id": "550e8400-e29b-41d4-a716-446655440001",
        "server": "motherduck",
        "transport": "http",
        "protocol_version": "2024-11-05",
        "opened_at": "2024-01-15T10:30:00Z",
        "closed_at": "2024-01-15T10:30:05Z",
        "sequence_id_start": 1,
        "sequence_id_end": 10
      }
    ]
  },
  "policy": {
    "thinking_visibility": "full",
    "pii_filter": false,
    "policy_version": "1.0"
  }
}
```

## Implementation Notes

### PydanticAI Integration

- Use `result.new_messages_json()` for raw message bytes
- Use `result.usage()` for comprehensive token tracking
- Use `event_stream_handler` for event aggregation
- Use `ModelMessagesTypeAdapter` for message rehydration

### Error Handling

- All failed events include `ErrorInfo` with code, message, and optional provider code
- Partial content is preserved on failure for debugging
- Buffer overflow is handled gracefully with truncation markers

### Performance Considerations

- Messages are stored as bytes for efficiency
- Optional compression reduces storage costs
- Event aggregation prevents storage bloat
- Indexing recommendations optimize query performance

This schema provides a comprehensive, future-proof foundation for agent response tracking and analysis while maintaining compatibility with PydanticAI, Anthropic thinking features, and MCP standards.
