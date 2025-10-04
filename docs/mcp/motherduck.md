# MCP Servers

Model Context Protocol (MCP) servers for the Hubble platform.

## Overview

The MCP (Model Context Protocol) servers provide AI models with access to external data sources and tools. Hubble includes a MotherDuck MCP server that enables AI models to query analytics databases and perform data operations.

## Architecture

```text
┌─────────────────────────────────────┐
│           AI Model                  │
│        (Claude, GPT, etc.)          │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         MCP Inspector               │
│      (Development Tool)             │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         MCP Server                  │
│      (MotherDuck Server)            │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         Data Sources                │
│    (MotherDuck, Fivetran)           │
└─────────────────────────────────────┘
```

## Available Servers

### MotherDuck Server

The MotherDuck MCP server provides AI models with access to MotherDuck analytics databases.

**Features:**

- Query analytics databases
- Execute SQL operations
- Access table schemas
- Perform data analysis
- Generate insights and reports

**Location:** `mcp/servers/motherduck/`

## Project Structure

```text
mcp/
├── servers/                    # MCP server implementations
│   ├── motherduck/            # MotherDuck MCP server
│   │   ├── server/            # Server implementation
│   │   │   ├── __init__.py    # Package initialization
│   │   │   ├── main.py        # Main server entry point
│   │   │   ├── database.py    # Database operations
│   │   │   ├── query.py       # Query execution
│   │   │   ├── schema.py      # Schema management
│   │   │   ├── auth.py        # Authentication
│   │   │   ├── config.py      # Configuration
│   │   │   ├── errors.py      # Error handling
│   │   │   ├── utils.py       # Utility functions
│   │   │   └── types.py       # Type definitions
│   │   ├── pyproject.toml     # Python project configuration
│   │   ├── package.json       # Node.js package configuration
│   │   ├── uv.lock            # Python dependency lock file
│   │   └── README.md          # Server documentation
│   ├── Dockerfile             # Container configuration
│   ├── Caddyfile              # Reverse proxy configuration
│   ├── inspector-config.json  # MCP Inspector configuration
│   └── start.sh               # Server startup script
├── mcp-dev.sh                 # Development script
└── start-mcp-dev.sh           # Development startup script
```

## Development

### Prerequisites

- **Python 3.11+**: Required for MCP server
- **uv**: Python package manager
- **Node.js 20+**: For development tools
- **Docker**: For containerization

### Getting Started

1. **Install Python dependencies**

```bash
cd mcp/servers/motherduck
uv sync
```

2. **Start development server**

```bash
pnpm mcp:dev:motherduck
```

3. **Start MCP Inspector**

```bash
pnpm mcp:inspector:motherduck
```

4. **Open Inspector**
   Navigate to [http://localhost:6274](http://localhost:6274)

### Available Scripts

```bash
# Development
pnpm mcp:dev:motherduck        # Start MotherDuck MCP server
pnpm mcp:inspector:motherduck  # Start MCP Inspector

# Python development
cd mcp/servers/motherduck
uv run python -m server --help  # Show server options
uv run ruff check               # Lint Python code
uv run ruff format              # Format Python code
```

## Configuration

### Environment Variables

```env
# MotherDuck Configuration
MD_ADMIN_TOKEN=your-motherduck-token
MD_DATABASE_NAME=md_org_123

# Server Configuration
LOG_LEVEL=debug
SERVER_PORT=9001
TRANSPORT=stream

# MCP Configuration
MCP_SERVER_NAME=motherduck
MCP_SERVER_VERSION=1.0.0
```

### Inspector Configuration

The MCP Inspector is configured via `mcp/servers/inspector-config.json`:

```json
{
    "servers": {
        "motherduck": {
            "command": "uv",
            "args": ["run", "python", "-m", "server"],
            "env": {
                "LOG_LEVEL": "debug"
            }
        }
    }
}
```

## Server Implementation

### Features

- **Database Queries**: Execute SQL queries on MotherDuck databases
- **Schema Introspection**: Get table and column information
- **Data Analysis**: Perform complex data analysis operations
- **Report Generation**: Generate insights and reports
- **Multi-tenant Support**: Support for multiple organization databases

### API Endpoints

#### Tools

- `query_database` - Execute SQL queries
- `get_schema` - Get database schema information
- `list_tables` - List available tables
- `describe_table` - Get table structure
- `analyze_data` - Perform data analysis

#### Resources

- `database://{org_id}` - Organization database
- `table://{org_id}/{table_name}` - Specific table
- `schema://{org_id}` - Database schema

### Usage Examples

#### Query Database

```python
# Execute a simple query
result = await query_database(
  org_id="org_123",
  query="SELECT * FROM users LIMIT 10"
)

# Execute with parameters
result = await query_database(
  org_id="org_123",
  query="SELECT * FROM users WHERE created_at > ?",
  parameters=["2024-01-01"]
)
```

#### Get Schema Information

```python
# Get database schema
schema = await get_schema(org_id="org_123")

# Get table structure
table_info = await describe_table(
  org_id="org_123",
  table_name="users"
)
```

#### Data Analysis

```python
# Perform data analysis
analysis = await analyze_data(
  org_id="org_123",
  table_name="sales",
  analysis_type="summary"
)
```

### Error Handling

The server includes comprehensive error handling:

```python
from server.errors import MCPError, DatabaseError, QueryError

try:
  result = await query_database(org_id, query)
except DatabaseError as e:
  # Handle database connection errors
  logger.error(f"Database error: {e}")
except QueryError as e:
  # Handle query execution errors
  logger.error(f"Query error: {e}")
except MCPError as e:
  # Handle general MCP errors
  logger.error(f"MCP error: {e}")
```

## Deployment

### Docker Deployment

The MCP servers are containerized for easy deployment:

```dockerfile
# Build image
docker build -t hubble-mcp-servers .

# Run container
docker run -p 9001:9001 \
  -e MD_ADMIN_TOKEN=your-token \
  -e LOG_LEVEL=info \
  hubble-mcp-servers
```

### AWS App Runner

The servers are configured for AWS App Runner deployment:

1. **Container Registry**: Push to ECR
2. **App Runner Service**: Create service from container
3. **Environment Variables**: Set required environment variables
4. **Health Checks**: Configure health check endpoints

### Health Checks

The server provides health check endpoints:

- `GET /health` - Basic health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics

## Security

### Authentication

- **MotherDuck Tokens**: Secure token-based authentication
- **Organization Scoping**: Data access scoped to organizations
- **Token Rotation**: Regular token rotation for security

### Data Protection

- **Encryption**: All data encrypted in transit and at rest
- **Access Control**: Role-based access control
- **Audit Logging**: Comprehensive audit logging

### Best Practices

1. **Never Log Sensitive Data**: Avoid logging tokens or sensitive information
2. **Validate Input**: Always validate and sanitize input
3. **Use HTTPS**: Ensure all communication is encrypted
4. **Regular Updates**: Keep dependencies updated

## Monitoring

### Logging

The server uses structured logging:

```python
import logging

logger = logging.getLogger(__name__)

# Log levels
logger.debug("Debug information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error message")
logger.critical("Critical error")
```

### Metrics

Prometheus metrics are available at `/metrics`:

- `mcp_requests_total` - Total number of requests
- `mcp_request_duration_seconds` - Request duration
- `mcp_errors_total` - Total number of errors
- `mcp_database_queries_total` - Total database queries

### Health Monitoring

- **Health Checks**: Regular health check endpoints
- **Liveness Probe**: Container liveness probe
- **Readiness Probe**: Container readiness probe

## Troubleshooting

### Common Issues

1. **Connection Errors**

- Check MotherDuck token validity
- Verify network connectivity
- Check firewall settings

2. **Authentication Errors**

- Verify token permissions
- Check organization access
- Validate token format

3. **Query Errors**

- Check SQL syntax
- Verify table existence
- Check permissions

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
DEBUG=true
```

### Logs

View server logs:

```bash
# Docker logs
docker logs hubble-mcp-servers

# Development logs
pnpm mcp:dev:motherduck 2>&1 | tee server.log
```

## Testing

### Unit Tests

```python
import pytest
from server.database import query_database
from server.errors import QueryError

async def test_query_database():
  result = await query_database(
      org_id="test_org",
      query="SELECT 1 as test"
  )
  assert result[0]["test"] == 1

async def test_query_error():
  with pytest.raises(QueryError):
      await query_database(
          org_id="test_org",
          query="INVALID SQL"
      )
```

### Integration Tests

```python
import pytest
from server.main import create_app

@pytest.fixture
async def app():
  return create_app()

async def test_health_endpoint(app):
  response = await app.get("/health")
  assert response.status_code == 200
  assert response.json() == {"status": "healthy"}
```

## Contributing

When contributing to MCP servers:

1. **Follow Python Standards**: Use PEP 8 and type hints
2. **Add Tests**: Include comprehensive tests
3. **Update Documentation**: Keep documentation current
4. **Security Review**: Ensure security best practices

## Related Documentation

- [MotherDuck Server Documentation](./servers/motherduck/README.md)
- [API Documentation](../api/README.md)
- [Database Schema](../supabase/README.md)
- [Deployment Guide](../deployment/README.md)
