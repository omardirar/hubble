# API Documentation

This document provides comprehensive API documentation for the Hubble platform.

## Overview

The Hubble API is built on Next.js API routes and provides RESTful endpoints for chat functionality, data pipeline management, and system operations. All APIs are versioned and follow consistent patterns for authentication, error handling, and response formatting.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://hubble.vercel.app`

## Authentication

All API endpoints require authentication via Clerk JWT tokens. Include the token in the Authorization header:

````http
Authorization: Bearer <jwt-token>
## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": <response-data>,
  "message": "Optional success message"
}
````

### Error Response

```json
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable error message",
        "details": "Additional error details"
    }
}
```

## Error Codes

| Code               | Description              |
| ------------------ | ------------------------ |
| `UNAUTHORIZED`     | Authentication required  |
| `FORBIDDEN`        | Insufficient permissions |
| `NOT_FOUND`        | Resource not found       |
| `VALIDATION_ERROR` | Invalid request data     |
| `RATE_LIMITED`     | Too many requests        |
| `INTERNAL_ERROR`   | Server error             |

## Rate Limiting

API endpoints are rate-limited per user:

- **Chat API**: 100 requests per minute
- **Connect API**: 10 requests per minute
- **General API**: 1000 requests per hour

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## API Endpoints

### Health & Status

#### GET /healthz

Health check endpoint.

**Response:**

```json
"ok"
```

#### GET /version

Application version information.

**Response:**

```json
{
    "version": "0.0.1",
    "build": "abc123",
    "timestamp": "2024-01-01T00:00:00Z"
}
```

### Chat API (v1)

The Chat API provides endpoints for managing conversations and messages.

### GET /api/v1/chat/conversations

List all conversations for the authenticated user.

**Query Parameters:**

- `limit` (optional): Number of conversations to return (default: 20, max: 100)
- `offset` (optional): Number of conversations to skip (default: 0)
- `status` (optional): Filter by status (`active`, `archived`)

**Response:**

```json
{
    "success": true,
    "data": {
        "conversations": [
            {
                "id": "conv_123",
                "title": "Marketing Strategy Discussion",
                "status": "active",
                "model": "claude-3-sonnet",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "message_count": 15
            }
        ],
        "pagination": {
            "limit": 20,
            "offset": 0,
            "total": 1,
            "has_more": false
        }
    }
}
```

#### POST /api/v1/chat/conversations

Create a new conversation.

**Request Body:**

```json
{
    "title": "New Conversation",
    "model": "claude-3-sonnet",
    "system_prompt": "Optional system prompt"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "conv_123",
        "title": "New Conversation",
        "status": "active",
        "model": "claude-3-sonnet",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
}
```

#### PATCH /api/v1/chat/conversations/[id]

Update a conversation.

**Request Body:**

```json
{
    "title": "Updated Title",
    "status": "archived"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "conv_123",
        "title": "Updated Title",
        "status": "archived",
        "updated_at": "2024-01-01T00:00:00Z"
    }
}
```

#### GET /api/v1/chat/messages/[conversationId]

List messages in a conversation.

**Query Parameters:**

- `limit` (optional): Number of messages to return (default: 50, max: 100)
- `offset` (optional): Number of messages to skip (default: 0)

**Response:**

```json
{
    "success": true,
    "data": {
        "messages": [
            {
                "id": "msg_123",
                "role": "user",
                "content": "Hello, how can you help me?",
                "text_content": "Hello, how can you help me?",
                "model": "claude-3-sonnet",
                "created_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "msg_124",
                "role": "assistant",
                "content": "I can help you with marketing strategies...",
                "text_content": "I can help you with marketing strategies...",
                "model": "claude-3-sonnet",
                "created_at": "2024-01-01T00:01:00Z"
            }
        ],
        "pagination": {
            "limit": 50,
            "offset": 0,
            "total": 2,
            "has_more": false
        }
    }
}
```

#### POST /api/v1/chat/messages/[conversationId]

Create a new message in a conversation.

**Request Body:**

```json
{
    "role": "user",
    "content": "What are the best marketing strategies for 2024?",
    "idempotency_key": "optional-unique-key"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "msg_123",
        "role": "user",
        "content": "What are the best marketing strategies for 2024?",
        "text_content": "What are the best marketing strategies for 2024?",
        "model": null,
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### POST /api/v1/chat

Send a chat request and get an AI response.

**Request Body:**

```json
{
    "conversation_id": "conv_123",
    "message": "What are the best marketing strategies for 2024?",
    "model": "claude-3-sonnet",
    "stream": true
}
```

**Response (Streaming):**

```json
{
    "success": true,
    "data": {
        "message_id": "msg_124",
        "content": "Based on current trends, here are the top marketing strategies...",
        "model": "claude-3-sonnet",
        "created_at": "2024-01-01T00:01:00Z"
    }
}
```

#### POST /api/v1/chat/generate-title

Generate a title for a conversation based on its messages.

**Request Body:**

```json
{
    "conversation_id": "conv_123",
    "message_preview": "First few messages of the conversation"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "title": "Marketing Strategy Discussion"
    }
}
```

### Connect API

The Connect API manages data pipeline provisioning and configuration.

#### POST /api/connect/enable

Start the data pipeline provisioning process.

**Request Body:**

```json
{
    "connector_types": ["facebook_ads", "google_ads"]
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "correlation_id": "prov_123",
        "status": "pending",
        "started_at": "2024-01-01T00:00:00Z"
    }
}
```

#### GET /api/connect/status

Check the status of a provisioning process.

**Query Parameters:**

- `correlation_id`: The provisioning correlation ID

**Response:**

```json
{
    "success": true,
    "data": {
        "correlation_id": "prov_123",
        "status": "running",
        "progress": 50,
        "current_step": "Creating MotherDuck database",
        "started_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:05:00Z",
        "timeline": [
            {
                "step": "Initializing",
                "status": "completed",
                "timestamp": "2024-01-01T00:00:00Z"
            },
            {
                "step": "Creating MotherDuck database",
                "status": "running",
                "timestamp": "2024-01-01T00:05:00Z"
            }
        ]
    }
}
```

#### GET /api/connect/stream

Get real-time updates for a provisioning process via Server-Sent Events.

**Query Parameters:**

- `correlation_id`: The provisioning correlation ID

**Response (SSE):**

````text
data: {"step": "Creating MotherDuck database", "status": "completed", "timestamp": "2024-01-01T00:05:00Z"}

data: {"step": "Creating Fivetran destination", "status": "running", "timestamp": "2024-01-01T00:06:00Z"}
#### GET /api/connect/overview

Get an overview of all connections and their status.

**Response:**

```json
{
  "success": true,
  "data": {
    "provisioning_status": "ready",
    "connections": [
      {
        "id": "conn_123",
        "type": "facebook_ads",
        "status": "healthy",
        "last_sync": "2024-01-01T00:00:00Z",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "data_destination": {
      "id": "dest_123",
      "status": "healthy",
      "database_name": "md_org_123",
      "last_event": "2024-01-01T00:00:00Z"
    }
  }
}
````

#### GET /api/connect/connector-types

Get available connector types.

**Response:**

```json
{
    "success": true,
    "data": [
        {
            "code": "facebook_ads",
            "label": "Facebook Ads",
            "description": "Connect your Facebook Ads data",
            "status": "available"
        },
        {
            "code": "google_ads",
            "label": "Google Ads",
            "description": "Connect your Google Ads data",
            "status": "available"
        }
    ]
}
```

#### POST /api/connect/connector/create

Create a new connector.

**Request Body:**

```json
{
    "type": "facebook_ads",
    "credentials": {
        "access_token": "your-access-token",
        "ad_account_id": "act_123456789"
    }
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "conn_123",
        "type": "facebook_ads",
        "status": "needs_auth",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### GET /api/connect/connector/status

Get the status of a specific connector.

**Query Parameters:**

- `connector_id`: The connector ID

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "conn_123",
        "type": "facebook_ads",
        "status": "healthy",
        "last_sync": "2024-01-01T00:00:00Z",
        "sync_frequency": "hourly",
        "next_sync": "2024-01-01T01:00:00Z"
    }
}
```

#### GET /api/connect/connections

List all connections.

**Query Parameters:**

- `status` (optional): Filter by status
- `type` (optional): Filter by connector type

**Response:**

```json
{
    "success": true,
    "data": {
        "connections": [
            {
                "id": "conn_123",
                "type": "facebook_ads",
                "status": "healthy",
                "last_sync": "2024-01-01T00:00:00Z",
                "created_at": "2024-01-01T00:00:00Z"
            }
        ]
    }
}
```

### MotherDuck Integration

#### POST /api/motherduck/create-database

Create a new MotherDuck database for the organization.

**Request Body:**

```json
{
    "database_name": "md_org_123",
    "description": "Organization analytics database"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "database_name": "md_org_123",
        "status": "created",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

### Background Jobs

#### POST /api/queues/provision

Queue a provisioning job for background processing.

**Request Body:**

```json
{
    "correlation_id": "prov_123",
    "org_id": "org_123",
    "connector_types": ["facebook_ads", "google_ads"]
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "job_id": "job_123",
        "status": "queued",
        "estimated_completion": "2024-01-01T00:10:00Z"
    }
}
```

## SDKs and Client Libraries

### JavaScript/TypeScript

```typescript
import { HubbleClient } from "@hubble/sdk"

const client = new HubbleClient({
    baseUrl: "https://hubble.vercel.app",
    apiKey: "your-api-key",
})

// Chat operations
const conversations = await client.chat.conversations.list()
const conversation = await client.chat.conversations.create({
    title: "New Conversation",
})

// Connect operations
const status = await client.connect.status("prov_123")
const overview = await client.connect.overview()
```

### cURL Examples

#### Create a conversation

```bash
curl -X POST https://hubble.vercel.app/api/v1/chat/conversations \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Conversation"}'
```

#### Send a chat message

```bash
curl -X POST https://hubble.vercel.app/api/v1/chat \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123",
    "message": "Hello, how can you help me?",
    "model": "claude-3-sonnet"
  }'
```

#### Start provisioning

```bash
curl -X POST https://hubble.vercel.app/api/connect/enable \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"connector_types": ["facebook_ads", "google_ads"]}'
```

## Webhooks

Hubble supports webhooks for real-time notifications:

### Webhook Events

- `conversation.created` - New conversation created
- `conversation.updated` - Conversation updated
- `message.created` - New message created
- `provision.started` - Provisioning started
- `provision.completed` - Provisioning completed
- `provision.failed` - Provisioning failed
- `connector.connected` - Connector successfully connected
- `connector.disconnected` - Connector disconnected

### Webhook Payload

```json
{
    "event": "conversation.created",
    "data": {
        "id": "conv_123",
        "title": "New Conversation",
        "org_id": "org_123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "timestamp": "2024-01-01T00:00:00Z"
}
```

## Rate Limits

| Endpoint Category | Limit         | Window   |
| ----------------- | ------------- | -------- |
| Chat API          | 100 requests  | 1 minute |
| Connect API       | 10 requests   | 1 minute |
| General API       | 1000 requests | 1 hour   |
| Webhooks          | 1000 requests | 1 hour   |

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request data",
        "details": {
            "field": "title",
            "reason": "Title is required"
        }
    }
}
```

## Changelog

### v1.0.0 (2024-01-01)

- Initial API release
- Chat API v1
- Connect API
- MotherDuck integration
- Background job processing

## Support

For API support and questions:

- **Documentation**: [docs.hubble.com](https://docs.hubble.com)
- **Support**: [support@hubble.com](mailto:support@hubble.com)
- **GitHub Issues**: [github.com/omzification/hubble/issues](https://github.com/omzification/hubble/issues)
