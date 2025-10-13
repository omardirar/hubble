# Server Architecture

This document describes the architecture of the Hubble server package, including the main components, their interactions, and sequence diagrams for key workflows.

## Overview

The server package provides a comprehensive set of utilities for building AI-powered applications with MCP (Model Context Protocol) integration. It includes:

- **Chat Agent Runtime**: Orchestrates AI model interactions and tool calls
- **MCP Client**: Manages connections to MCP servers
- **Connection Manager**: Handles multiple MCP server connections
- **Persistence Service**: Manages chat data storage
- **Utility Services**: Input validation, error handling, rate limiting, etc.

## Core Components

### 1. ChatAgentRuntime

The `ChatAgentRuntime` is the central orchestrator that manages AI model interactions and tool calls via MCP. It handles:

- Connection management for MCP servers
- Tool aggregation and execution
- Message streaming and completion tracking
- Error handling and recovery
- Multi-server support with capability negotiation

### 2. MCP Client

The `McpClientConnection` provides a high-level wrapper around the official MCP TypeScript SDK. It handles:

- Transport setup and connection management
- Capability registration and session management
- Tool wrapping for the AI SDK
- Error handling and retry logic

### 3. Connection Manager

The `McpConnectionManager` manages multiple MCP server connections with:

- Connection pooling and reuse
- Tool aggregation from multiple servers
- Graceful degradation and fallback
- Lifecycle management

### 4. Persistence Service

The `ChatPersistenceService` centralizes all chat-related database operations with:

- Conversation and message management
- Proper error handling and validation
- Transaction support
- Optimized logging for hot paths

## Architecture Diagrams

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Chat UI]
        API[API Routes]
    end

    subgraph "Server Package"
        subgraph "Core Services"
            CAR[ChatAgentRuntime]
            CPS[ChatPersistenceService]
        end

        subgraph "MCP Layer"
            MCM[McpConnectionManager]
            MCC[McpClientConnection]
            CP[ConnectionPool]
        end

        subgraph "Utilities"
            IV[InputValidation]
            EH[ErrorHandling]
            RL[RateLimiting]
            TH[TimeoutHandling]
        end
    end

    subgraph "External Services"
        MCP1[MCP Server 1]
        MCP2[MCP Server 2]
        DB[(Database)]
        AI[AI Model]
    end

    UI --> API
    API --> CAR
    CAR --> MCM
    MCM --> MCC
    MCC --> MCP1
    MCC --> MCP2
    CAR --> CPS
    CPS --> DB
    CAR --> AI

    CAR --> IV
    CAR --> EH
    CAR --> RL
    CAR --> TH
```

### Chat Flow Sequence

```mermaid
sequenceDiagram
    participant UI as Chat UI
    participant API as API Route
    participant CAR as ChatAgentRuntime
    participant MCM as McpConnectionManager
    participant MCC as McpClientConnection
    participant MCP as MCP Server
    participant AI as AI Model
    participant DB as Database

    UI->>API: Send message
    API->>CAR: sendUserMessage()
    CAR->>MCM: aggregateTools()
    MCM->>MCC: getToolSet()
    MCC->>MCP: listTools()
    MCP-->>MCC: tools[]
    MCC-->>MCM: toolSet
    MCM-->>CAR: aggregatedTools

    CAR->>AI: streamText(messages, tools)
    AI-->>CAR: stream result

    loop Tool calls
        CAR->>MCC: executeTool()
        MCC->>MCP: callTool()
        MCP-->>MCC: tool result
        MCC-->>CAR: result
    end

    CAR->>DB: persist messages
    DB-->>CAR: success
    CAR-->>API: completion
    API-->>UI: response
```

### MCP Connection Management

```mermaid
sequenceDiagram
    participant CAR as ChatAgentRuntime
    participant MCM as McpConnectionManager
    participant CP as ConnectionPool
    participant MCC as McpClientConnection
    participant MCP as MCP Server
    participant SM as SecretsManager

    CAR->>MCM: connectToServers()
    MCM->>SM: getCachedMcpHeaders()
    SM-->>MCM: headers or null

    alt Headers cached
        MCM->>CP: getConnection()
        CP-->>MCM: existing connection
    else No cached headers
        MCM->>MCC: connect()
        MCC->>MCP: establish connection
        MCP-->>MCC: connection established
        MCC-->>MCM: connection
        MCM->>SM: cacheMcpHeaders()
    end

    MCM-->>CAR: connections map
```

### Error Handling and Recovery

```mermaid
sequenceDiagram
    participant CAR as ChatAgentRuntime
    participant EH as ErrorHandler
    participant RL as RateLimiter
    participant RM as RetryManager
    participant MCP as MCP Server

    CAR->>MCP: tool call
    MCP-->>CAR: error

    CAR->>EH: handleError()
    EH->>RL: checkRateLimit()
    RL-->>EH: can retry

    alt Can retry
        EH->>RM: executeWithRetry()
        RM->>MCP: retry tool call
        MCP-->>RM: success
        RM-->>EH: result
    else Rate limited
        EH-->>CAR: rate limit error
    end

    EH-->>CAR: final result
```

## Key Features

### 1. Connection Pooling

The connection pool manages MCP connections efficiently:

- Reuses existing connections when possible
- Manages connection lifecycle
- Handles connection health monitoring
- Provides graceful degradation

### 2. Tool Aggregation

Tools from multiple MCP servers are aggregated with:

- Namespacing to avoid conflicts
- Capability negotiation
- Fallback strategies
- Rate limiting per conversation

### 3. Error Handling

Comprehensive error handling includes:

- Structured error logging
- User-friendly error messages
- Retry logic with exponential backoff
- Circuit breakers for failing services

### 4. Input Validation

Robust input validation provides:

- Message length limits
- Content filtering
- SQL query sanitization
- Tool argument validation

### 5. Security

Security features include:

- CORS and security headers
- Secrets caching and encryption
- Rate limiting and abuse prevention
- Input sanitization

## Configuration

The server package supports extensive configuration through:

- Environment variables
- Configuration files
- Runtime options
- Per-connection settings

## Monitoring and Observability

Built-in monitoring includes:

- Structured logging
- Telemetry collection
- Performance metrics
- Error tracking
- Health checks

## Performance Optimizations

Key performance features:

- Connection pooling
- Optimized logging with sampling
- Request caching and deduplication
- Lazy loading of tools
- Efficient error handling

## Future Enhancements

Planned improvements include:

- Enhanced monitoring and metrics
- Advanced caching strategies
- Improved error recovery
- Better resource management
- Enhanced security features
