# H10S Agents Service

AI-powered Marketing Copilot service built with Pydantic AI, LangGraph, FastAPI, and Supabase.

## Overview

The H10S Agents Service provides an intelligent marketing copilot using a supervisor-specialist architecture. It orchestrates multiple AI specialists (Performance Analyst, SEO Specialist, Planner, Media Buyer) coordinated by a supervisor agent, built on LangGraph with Model Context Protocol (MCP) tools for data access.

### Key Features

- 🤖 **Supervisor-Specialist Architecture**: Multi-agent system with LangGraph coordination
- 🔄 **Real-time Streaming**: Server-Sent Events for streaming responses
- 💾 **Persistent Conversations**: Thread-based conversation history with Supabase
- 🔐 **Multi-tenant Security**: Clerk JWT authentication with RLS policies
- 🛠️ **MCP Tool Integration**: MotherDuck analytics via Model Context Protocol
- 🎯 **Type-safe**: Full type hints with Pydantic validation
- 🚀 **LangGraph Studio Compatible**: Develop and debug with LangGraph CLI

## Prerequisites

- Python 3.12+
- PostgreSQL 15+ (via Supabase)
- Anthropic API key (for Claude models)
- Clerk account for authentication
- Optional: MotherDuck token for analytics tools

## Installation

### 1. Install dependencies

```bash
# From repository root
moon sync

# Or directly with uv
uv sync --project services/agents
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Core runtime (required)
ANTHROPIC_API_KEY=sk-ant-...
ENVIRONMENT=development
LOG_LEVEL=INFO

# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk authentication (required for API)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_ISSUER=https://clerk.your-app.com

# CORS configuration
CORS_ORIGINS=http://localhost:3000

# Optional: MotherDuck MCP server
MCP_MOTHERDUCK_URL=http://127.0.0.1:8001
MOTHERDUCK_TOKEN=your-motherduck-token
DATABASE_NAME=hubble_dev
```

### 3. Run database migrations

```bash
# From repository root using Supabase CLI
cd /path/to/hubble
supabase db push
```

## Running the Service

### Development (API Server)

```bash
# From repository root
moon run agents:api-dev

# Or directly with uvicorn
cd services/agents
uvicorn h10s.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Development (LangGraph Studio)

```bash
# From repository root
langgraph dev

# Access LangGraph Studio at http://127.0.0.1:56173
```

### Production (Docker)

```bash
# From repository root
moon run agents:dev

# Or with docker compose
docker compose up agents-api
```

## API Documentation

Once running, visit:

- **Swagger UI**: <http://localhost:8000/docs> (development only)
- **Health Check**: <http://localhost:8000/health>
- **LangGraph Studio**: <http://127.0.0.1:56173> (when using `langgraph dev`)

### Key Endpoints

#### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "environment": "development",
  "service": "h10s-agents"
}
```

#### `POST /threads`

Create a new conversation thread.

**Headers:**

```http
Authorization: Bearer <CLERK_JWT_TOKEN>
Content-Type: application/json
```

**Response:**

```json
{
  "thread_id": "uuid"
}
```

#### `POST /threads/{thread_id}/runs/stream`

Stream AI responses via Server-Sent Events.

**Request:**

```json
{
  "input": {
    "messages": [
      {
        "role": "user",
        "content": "Analyze our Q4 marketing performance"
      }
    ]
  }
}
```

**Headers:**

```http
Authorization: Bearer <CLERK_JWT_TOKEN>
Content-Type: application/json
```

**Response:** Server-Sent Events stream with LangGraph events

## Configuration

### Environment Variables

| Variable                        | Default                      | Description                            |
| ------------------------------- | ---------------------------- | -------------------------------------- |
| `ENVIRONMENT`                   | `development`                | Runtime environment                    |
| `LOG_LEVEL`                     | `INFO`                       | Logging level                          |
| `ANTHROPIC_API_KEY`             | _required_                   | Anthropic API key for Claude models    |
| `LLM_MODEL`                     | `claude-3-7-sonnet-20250219` | Model to use for agents                |
| `SUPABASE_URL`                  | _required_                   | Supabase project URL                   |
| `SUPABASE_DB_URL`               | _required_                   | PostgreSQL connection string           |
| `SUPABASE_SERVICE_ROLE_KEY`     | _required_                   | Supabase service role key              |
| `DB_POOL_MIN_SIZE`              | `2`                          | Min DB connections                     |
| `DB_POOL_MAX_SIZE`              | `10`                         | Max DB connections                     |
| `DB_POOL_MAX_INACTIVE_LIFETIME` | `300.0`                      | Max connection idle time (seconds)     |
| `CLERK_PUBLISHABLE_KEY`         | _required_                   | Clerk publishable key                  |
| `CLERK_ISSUER`                  | _required_                   | Clerk issuer URL                       |
| `CLERK_AUDIENCE`                | `None`                       | Optional JWT audience claim            |
| `CORS_ORIGINS`                  | `http://localhost:3000`      | Allowed CORS origins (comma-separated) |
| `MAX_REQUEST_BODY_SIZE`         | `1000000`                    | Max request size (bytes)               |
| `MAX_JSON_PAYLOAD_SIZE`         | `500000`                     | Max JSON payload size (bytes)          |
| `MCP_MOTHERDUCK_URL`            | `None`                       | MotherDuck MCP server URL              |
| `MOTHERDUCK_TOKEN`              | `None`                       | MotherDuck authentication token        |
| `DATABASE_NAME`                 | `None`                       | Default MotherDuck database name       |

### Clerk JWT Format

The service expects Clerk JWT tokens with the following claims:

```json
{
  "sub": "user_xxx",
  "org_id": "org_xxx",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "https://clerk.your-app.com"
}
```

## Database Schema

### Tables

All tables live in the `public` schema (for Supabase client compatibility):

- **`conversations`**: Thread metadata with org/user isolation
- **`messages`**: User and assistant messages
- **`runs`**: LangGraph execution runs with status tracking
- **`run_checkpoints`**: LangGraph state checkpoints for resumable execution

### Row Level Security (RLS)

All tables have RLS policies enforcing:

- **Org-level isolation**: Uses `jwt_claim('org_id')` for Clerk JWT compatibility
- **User-level access control**: Additional user-scoped restrictions
- **Service role bypass**: Backend operations bypass RLS for admin tasks

## Security

### Authentication

- Clerk JWT tokens required for all API endpoints
- Token verification via Clerk JWKS
- Organization ID extraction from JWT claims
- Automatic token validation on each request

### Authorization

- Org-level and user-level claims validation
- RLS policies enforced at database layer
- Service role for backend operations
- Request validation before database operations

### Input Validation

- Request body size limits (1MB default)
- JSON payload size limits (500KB default)
- Pydantic validation for all request/response models
- Content-type validation

### Network Security

- CORS with strict origin control
- Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
- Trusted host middleware
- HTTPS enforcement in production recommended

## Development Guide

### Project Structure

```text
services/agents/
├── src/h10s/
│   ├── api/              # FastAPI application
│   │   ├── routers/      # API route handlers
│   │   │   ├── health.py # Health check endpoint
│   │   │   ├── threads.py# Thread management
│   │   │   └── runs.py   # Run streaming
│   │   ├── deps.py       # FastAPI dependencies
│   │   └── main.py       # ASGI app factory
│   ├── auth/             # Authentication
│   │   └── clerk.py      # Clerk JWT validation
│   ├── config/           # Settings management
│   │   └── settings.py   # Pydantic settings
│   ├── db/               # Database layer
│   │   ├── pool.py       # Connection pooling
│   │   └── repositories/ # Data access patterns
│   ├── graphs/           # LangGraph definitions
│   │   ├── copilot.py    # Marketing copilot graph
│   │   ├── mcp_tools.py  # MCP tool integration
│   │   ├── nodes.py      # Agent node implementations
│   │   └── state.py      # Graph state definitions
│   └── schema/           # Pydantic models
│       ├── api.py        # API request/response models
│       └── domain.py     # Domain models
├── scripts/              # Utility scripts
│   ├── generate_graphs.py# Generate graph diagrams
│   └── generate_token.py # Test JWT generation
├── tests/                # Test suite
│   ├── integration/      # Integration tests
│   └── unit/             # Unit tests
├── .env.example          # Environment template
├── langgraph.json        # LangGraph configuration
├── pyproject.toml        # Dependencies & tooling
└── README.md             # This file
```

### Running Tests

```bash
# From repository root
moon run agents:test

# Or directly with pytest
cd services/agents
pytest

# Run specific test
uv run --project . pytest tests/path/to/test_file.py::test_function

# With coverage
moon run agents:test-cov
```

### Code Quality

```bash
# From repository root
moon run agents:format      # Format code
moon run agents:lint        # Lint with ruff
moon run agents:typecheck   # Type check with mypy

# Or directly
cd services/agents
ruff format .
ruff check .
mypy src/
```

## Monitoring & Observability

### Health Checks

```bash
curl http://localhost:8000/health

# Response
{
  "status": "healthy",
  "environment": "development",
  "service": "h10s-agents"
}
```

### Logging

Structured logs with context:

```text
2025-01-20 12:00:00 INFO [h10s.api.chat.copilot] Crew execution completed
```

### OpenTelemetry (Optional)

Configure for distributed tracing:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=h10s-agents
SIGNOZ_INGESTION_KEY=your-key  # If using SigNoz
```

### LangGraph Studio

Develop and debug graphs interactively:

```bash
# Start LangGraph dev server
langgraph dev

# Run LangGraph tests
langgraph test

# Access Studio UI at http://127.0.0.1:56173
```

## Troubleshooting

### Common Issues

#### Missing ANTHROPIC_API_KEY

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...
```

#### Clerk authentication failed

- Verify `CLERK_PUBLISHABLE_KEY` and `CLERK_ISSUER` are correct
- Ensure JWT token is from the correct Clerk instance
- Check that the token includes `org_id` claim

#### Database pool connection failed

- Verify `SUPABASE_DB_URL` is correct
- Check network connectivity to database
- Ensure database migrations are applied
- Check firewall rules

#### JWT token expired

- Tokens have configurable expiration
- Check system clock synchronization
- Adjust `JWT_LEEWAY_SECONDS` if needed (default 60s)

#### Thread not accessible

- Verify `org_id` in JWT matches thread's organization
- Check RLS policies use `jwt_claim('org_id')` correctly
- Ensure service role key has RLS bypass for backend operations

#### MCP tools not working

- Verify `MCP_MOTHERDUCK_URL` is accessible
- Check `MOTHERDUCK_TOKEN` is valid
- Ensure MCP server is running: `docker compose up mcp`

#### JSON payload too large

- Check `MAX_JSON_PAYLOAD_SIZE` setting
- Reduce message content size
- Consider pagination for large datasets

## Production Deployment

### Pre-deployment Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Configure production `ANTHROPIC_API_KEY`
- [ ] Set production `CLERK_PUBLISHABLE_KEY` and `CLERK_ISSUER`
- [ ] Configure CORS origins for your production domain(s)
- [ ] Set up SSL/TLS certificates (handled by Fly.io)
- [ ] Configure database connection pooling for your load
- [ ] Enable OpenTelemetry for monitoring
- [ ] Set up log aggregation
- [ ] Test RLS policies with real organizational data
- [ ] Load test streaming endpoints
- [ ] Set up alerting (error rates, latency, pool exhaustion)
- [ ] Configure MCP server endpoints for production

### Performance Tuning

```bash
# Database pool sizing (rule of thumb: 2-3x CPU cores)
DB_POOL_MAX_SIZE=20
DB_POOL_MIN_SIZE=2

# Worker processes (rule of thumb: 2x CPU cores + 1)
uvicorn h10s.main:app --workers 9

# OS limits
ulimit -n 65536  # File descriptors
```

### Security Hardening

1. **Never commit secrets** - use environment variables or secrets management
2. **Clerk key rotation** - follow Clerk's key rotation best practices
3. **Monitor for unusual activity** - set up alerts for auth failures
4. **Rate limiting** - consider adding rate limiting middleware
5. **Regular updates** - keep dependencies up to date with `uv sync`
6. **Audit logs** - enable database audit logging in Supabase
7. **Network segmentation** - restrict database access to application servers only
8. **MCP security** - ensure MCP servers have proper authentication

## Architecture Notes

### Supervisor-Specialist Pattern

The copilot uses a hierarchical agent architecture:

- **Supervisor**: Coordinates task delegation and synthesizes responses
- **Performance Analyst**: Analyzes metrics with MotherDuck database access
- **SEO Specialist**: Provides organic search optimization advice
- **Planner**: Develops strategic marketing plans
- **Media Buyer**: Advises on paid advertising strategy

### LangGraph Integration

- State-based graph execution with checkpointing
- Streaming responses via Server-Sent Events
- Tool calling with Model Context Protocol
- Conditional routing between specialists
- Resumable execution from checkpoints

### Async/Await Pattern

- Database operations are fully async with asyncpg
- Connection pooling with proper lifecycle management
- Non-blocking SSE streaming
- Async MCP tool integration

### Modern FastAPI Patterns

- **Lifespan context manager** for startup/shutdown
- **Dependency injection** for database, auth, and settings
- **Middleware chain** for CORS and authentication
- **Type-safe schemas** with Pydantic v2

## Tech Stack Summary

- **Agent Framework**: Pydantic AI + LangGraph
- **LLM**: Anthropic Claude 3.7 Sonnet
- **API Framework**: FastAPI with SSE streaming
- **Database**: PostgreSQL via Supabase with RLS
- **Auth**: Clerk JWT tokens
- **Tools**: Model Context Protocol (MCP)
- **Analytics**: MotherDuck (DuckDB)
- **Deployment**: Fly.io with Docker

## Contributing

1. Create a feature branch from `main`
2. Make changes with comprehensive tests
3. Run quality checks: `moon run agents:lint agents:typecheck agents:test`
4. Update documentation if needed
5. Submit PR with clear description

## License

Proprietary - All Rights Reserved
