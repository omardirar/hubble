# H10S Agents Service

AI-powered Growth Copilot service built with FastAPI, CrewAI, and Supabase.

## Overview

The H10S Agents Service provides an intelligent copilot system for growth marketing strategy. It uses CrewAI for orchestrating AI agents and streams responses via Server-Sent Events (SSE).

### Key Features

- 🤖 **AI Agent Orchestration**: Hierarchical crew management with CrewAI
- 🔄 **Real-time Streaming**: SSE-based response streaming
- 💾 **Persistent Conversations**: Full conversation history with Supabase
- 🔐 **Multi-tenant Security**: JWT authentication with RLS policies
- 📊 **Usage Tracking**: LLM token usage monitoring
- 🎯 **Type-safe**: Full type hints with Pydantic validation

## Prerequisites

- Python 3.12+
- PostgreSQL 15+ (via Supabase)
- OpenAI API key (for LLM)
- JWT secret (64+ characters, high entropy)

## Installation

### 1. Install dependencies

```bash
# Using uv (recommended)
uv sync

# Or with pip
pip install -e .
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials - **important security note**: generate a cryptographically random JWT secret with high entropy:

```bash
# Generate a secure JWT secret
openssl rand -base64 64

# Required
OPENAI_API_KEY=sk-...
JWT_SECRET=<your-64-character-cryptographically-random-secret>
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project.supabase.co

# Optional (for production)
ENVIRONMENT=production
LOG_LEVEL=INFO
DB_POOL_MAX_SIZE=20
CORS_ORIGINS=https://yourdomain.com
```

### 3. Run database migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually apply migrations in order
psql $SUPABASE_DB_URL -f supabase/migrations/20251020182559_init_h10s_persistence.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251023000000_add_performance_indexes.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251023000001_add_rls_policies.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251023000002_add_message_sequence.sql
```

## Running the Service

### Development

```bash
uvicorn h10s.main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
uvicorn h10s.main:app --workers 4 --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:

- **Swagger UI**: <http://localhost:8000/docs> (development only)
- **Health Check**: <http://localhost:8000/health>

### Key Endpoints

#### `POST /api/copilot/stream`

Stream AI copilot responses via SSE.

**Request:**

```json
{
  "conversation_id": "uuid",
  "org_id": "uuid",
  "user_id": "uuid",
  "prompt": "Create a Q1 marketing campaign for our SaaS product",
  "metadata": {
    "title": "Q1 Campaign Planning"
  }
}
```

**Headers:**

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response:** Server-Sent Events stream

```text
event: crew_run.started
data: {"crew_run_id":"...","ts":"...","payload":{"status":"running"}}

event: block.delta
data: {"crew_run_id":"...","payload":{"delta":"Campaign strategy..."}}

event: crew_run.completed
data: {"crew_run_id":"...","payload":{"status":"complete"}}
```

## Configuration

### Environment Variables

| Variable                        | Default                 | Description                                    |
| ------------------------------- | ----------------------- | ---------------------------------------------- |
| `ENVIRONMENT`                   | `development`           | Runtime environment                            |
| `LOG_LEVEL`                     | `INFO`                  | Logging level                                  |
| `JWT_SECRET`                    | _required_              | HMAC secret (64+ chars, high entropy required) |
| `JWT_AUDIENCE`                  | `None`                  | JWT audience claim                             |
| `JWT_ISSUER`                    | `None`                  | JWT issuer claim                               |
| `OPENAI_API_KEY`                | _required_              | OpenAI API key                                 |
| `SUPABASE_URL`                  | _required_              | Supabase project URL                           |
| `SUPABASE_DB_URL`               | _required_              | PostgreSQL connection string                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | _required_              | Supabase service role key                      |
| `DB_POOL_MIN_SIZE`              | `2`                     | Min DB connections                             |
| `DB_POOL_MAX_SIZE`              | `10`                    | Max DB connections                             |
| `DB_POOL_MAX_INACTIVE_LIFETIME` | `300.0`                 | Max connection idle time (seconds)             |
| `CORS_ORIGINS`                  | `http://localhost:3000` | Allowed CORS origins (comma-separated)         |
| `ALLOWED_HOSTS`                 | `localhost,127.0.0.1`   | Trusted hosts                                  |
| `MAX_REQUEST_BODY_SIZE`         | `1000000`               | Max request size (bytes)                       |
| `MAX_JSON_PAYLOAD_SIZE`         | `500000`                | Max JSON payload size (bytes)                  |
| `SSE_PING_INTERVAL_SECONDS`     | `15`                    | SSE keepalive interval                         |

### JWT Token Format

The service expects JWT tokens with the following claims:

```json
{
  "sub": "user-id",
  "org_id": "organization-id",
  "user_id": "user-id",
  "exp": 1234567890,
  "iat": 1234567890
}
```

## Database Schema

### Tables

- **`chat.conversations`**: Conversation metadata with org/user isolation
- **`chat.messages`**: User and assistant messages with atomic sequencing
- **`chat.runs`**: Crew execution runs with status tracking
- **`chat.usage`**: LLM token usage tracking for billing
- **`chat.conversation_sequences`**: Atomic message sequence generation (prevents race conditions)

### Row Level Security (RLS)

All tables have RLS policies enforcing:

- **Org-level isolation**: Users can only access data from their organization
- **User-level access control**: Additional user-scoped restrictions
- **Service role bypass**: Backend operations bypass RLS for admin tasks

## Security

### Authentication

- JWT tokens required for all API endpoints
- HMAC-SHA256 signature verification
- **Token entropy validation** (3.5+ bits/char) - rejects weak secrets
- Configurable audience and issuer checks
- 60-second leeway for clock skew

### Authorization

- Org-level and user-level claims validation
- RLS policies enforced at database layer
- Service role for backend operations
- Request validation before database operations

### Input Validation

- Request body size limits (1MB default)
- JSON payload size limits (500KB default) to prevent DoS
- Prompt length limits (50K chars)
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
│   ├── api/              # FastAPI routes
│   │   ├── chat/         # Copilot endpoints
│   │   └── health.py     # Health check
│   ├── config/           # Settings management
│   ├── crews/            # CrewAI definitions
│   │   └── copilot/      # Growth copilot crew
│   ├── db/               # Database layer
│   │   ├── client.py     # Connection pool
│   │   └── repositories/ # Data access
│   ├── listeners/        # Event handlers
│   ├── middleware/       # Auth & security
│   ├── schema/           # Pydantic models & enums
│   ├── telemetry/        # Logging & tracing
│   ├── tools/            # Agent tools (MCP)
│   ├── utils/            # Utilities
│   ├── validation/       # Input validation
│   ├── app.py            # FastAPI factory with lifespan
│   └── main.py           # ASGI entry point
├── tests/                # Test suite
├── pyproject.toml        # Dependencies
└── README.md             # This file
```

### Running Tests

```bash
# Install dev dependencies
uv sync --extra dev

# Run tests
pytest

# With coverage
pytest --cov=h10s --cov-report=html
```

### Code Quality

```bash
# Format code
ruff format .

# Lint
ruff check .

# Type check
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

Configure for distributed tracing and metrics:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=h10s-agents
SIGNOZ_INGESTION_KEY=your-key  # If using SigNoz
```

## Troubleshooting

### Common Issues

#### Invalid environment configuration: JWT_SECRET has low entropy

```bash
# Generate a secure secret with high entropy
openssl rand -base64 64
```

#### Database pool connection failed

- Verify `SUPABASE_DB_URL` is correct
- Check network connectivity to database
- Ensure database migrations are applied
- Check firewall rules

#### JWT token expired

- Tokens have configurable expiration
- Check system clock synchronization
- Adjust `JWT_LEEWAY_SECONDS` if needed (default 60s)

#### Conversation not accessible

- Verify `org_id` and `user_id` match JWT claims
- Check RLS policies are properly configured
- Ensure service role key has RLS bypass

#### JSON payload too large

- Check `MAX_JSON_PAYLOAD_SIZE` setting
- Reduce message content size
- Consider pagination for large datasets

## Production Deployment

### Pre-deployment Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Use cryptographically random JWT secret (64+ chars, high entropy)
- [ ] Configure CORS origins for your production domain(s)
- [ ] Set up SSL/TLS certificates
- [ ] Configure database connection pooling for your load
- [ ] Enable OpenTelemetry for monitoring
- [ ] Set up log aggregation (e.g., CloudWatch, Datadog)
- [ ] Configure backup strategy for Supabase
- [ ] Test RLS policies with real data
- [ ] Load test critical endpoints
- [ ] Set up alerting (error rates, latency, pool exhaustion)
- [ ] Document incident response procedures

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
2. **Rotate JWT secrets periodically** - implement key rotation strategy
3. **Monitor for unusual activity** - set up alerts for auth failures
4. **Rate limiting** - consider adding rate limiting middleware (e.g., slowapi)
5. **Regular updates** - keep dependencies up to date
6. **Audit logs** - enable database audit logging
7. **Network segmentation** - restrict database access to application servers only

## Architecture Notes

### Async/Await Pattern

The service uses async/await throughout for optimal performance:

- Database operations are fully async with asyncpg
- Connection pooling with lazy initialization and eager startup
- Background task management with proper cleanup on shutdown
- SSE streaming without blocking the event loop

### Race Condition Prevention

Message sequencing uses an atomic database function (`chat.get_next_message_seq`) to prevent race conditions in concurrent requests.

### Modern FastAPI Patterns

- **Lifespan context manager** (not deprecated `@app.on_event`)
- **Dependency injection** for database and settings
- **Proper shutdown** with task cleanup and graceful connection closure
- **Type-safe enums** replacing magic strings

## Contributing

1. Create a feature branch from `main`
2. Make changes with comprehensive tests
3. Run quality checks (`ruff format`, `ruff check`, `mypy`, `pytest`)
4. Update documentation if needed
5. Submit PR with clear description

## License

Proprietary - All Rights Reserved

## Support

For issues and questions:

- GitHub Issues: <https://github.com/yourusername/hubble/issues>
- Internal Slack: #engineering-agents
