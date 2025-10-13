# Hubble Agent Backend

Pydantic AI agents for intelligent chat orchestration.

## Local Development

```bash
# Install dependencies (from services/agents)
uv sync
# or from repo root
pnpm sync:agents

# Start development server
uv run --env-file ../../.env.local uvicorn src.main:app --reload --port 8001

# Or use the Turborepo script from root
pnpm dev:agents
```

## Interactive CLI Testing

Test the iterative workflow interactively from the command line with **Anthropic Extended Thinking** capabilities:

### Setup

The CLI automatically loads environment variables from `.env.local` in the project root. Make sure your `.env.local` file contains:

```bash
# Required
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional: for data query testing
MOTHERDUCK_TOKEN="your-motherduck-token"
DATABASE_NAME="your-database-name"
MCP_SERVER_URL="http://localhost:3001"

# Optional: thinking configuration
ANTHROPIC_THINKING=enabled
ANTHROPIC_THINKING_BUDGET=4096
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# MCP Server Configuration (HTTP/SSE Transport)
MCP_MOTHERDUCK_URL=http://localhost:8001
MCP_DICE_URL=http://localhost:8002

# Optional MCP servers
# MCP_ANALYTICS_URL=http://localhost:8003
# MCP_CONTENT_URL=http://localhost:8004
# ANALYTICS_TOKEN=your_analytics_token
# CONTENT_TOKEN=your_content_token
```

### Usage

Interactive mode (continuous chat):

```bash
# From project root
pnpm cli:agents

# Or from services/agents directory
uv run python cli_workflow.py
```

Single query mode:

```bash
# From project root
pnpm cli:agents "Show me my top performing campaigns"

# Or from services/agents directory
uv run python cli_workflow.py "Show me my top performing campaigns"
```

### Features

- **🧠 Agent Reasoning**: See how agents think through problems with Anthropic Extended Thinking
- **🔄 Real-time iteration tracking** with visual feedback
- **📊 Quality scores** displayed after each iteration
- **💬 Reviewer feedback** shown during improvement cycles
- **🎨 Color-coded output** for different agents
- **💡 Follow-up question suggestions**
- **⚡ Real-time streaming** of agent responses
- **🔍 Debug mode** for detailed workflow information
- **🔌 MCP server integration** with local/remote servers
- **🔧 Tool discovery and execution tracking**
- **🏥 Connection health monitoring** and auto-reconnect
- **⚙️ Native and MCP tool support**

### Commands

- `/exit` - Exit the CLI
- `/help` - Show help message
- `/clear` - Clear the screen
- `/thinking on/off` - Toggle agent reasoning display
- `/debug` - Toggle debug mode for detailed information
- `/supervisor on/off` - Toggle supervisor orchestration mode
- `/tools on/off` - Toggle tool-based agent architecture
- `/mcp` - Show MCP server connection status
- `/tools` - List all available tools (native + MCP)
- `/health` - Check MCP server health and reconnect

### Example Output

```text
🧭 [ORCHESTRATOR] Analyzing your query...
  💭 Thinking (orchestrator): Analyzing keywords... "sales data" indicates data query...
  → Routing to: motherduck (confidence: 0.95)

🦆 [MOTHERDUCK] Generating query...
  💭 Thinking (motherduck): Need to join sales table with products...
              Consider date range filters... GROUP BY region...
  → SQL: SELECT region, SUM(amount) FROM sales...

🔍 [REVIEWER] Evaluating response quality...
  💭 Thinking (reviewer): Response covers the query well, includes SQL and results...
  ✓ Quality Score: 0.85/1.0

🧠 Reasoning Summary:
  • Agent: Analyzing keywords... "sales data" indicates data query...
  • Agent: Need to join sales table with products... Consider date range filters...
  • Agent: Response covers the query well, includes SQL and results...
  Total thinking entries: 3
```

## MCP Server Configuration

The agents system supports connecting to multiple MCP (Model Context Protocol) servers for enhanced tool capabilities.

### Local MCP Development

Start local MCP servers:

```bash
# Start MCP servers (from project root)
cd services/mcp
pnpm dev

# This starts:
# - MotherDuck MCP server on http://localhost:8001
# - Dice Roll MCP server on http://localhost:8002
```

### Environment Variables

Configure MCP servers in your `.env.local`:

```env
# Local MCP Servers (default)
MCP_MOTHERDUCK_URL=http://localhost:8001
MCP_DICE_URL=http://localhost:8002

# Production MCP Servers (optional)
# MCP_MOTHERDUCK_URL=https://mcp.hubble.systems/motherduck

# Authentication (optional for local)
MOTHERDUCK_TOKEN=your_token_here
DATABASE_NAME=hubble_dev

# Optional MCP servers
MCP_ANALYTICS_URL=http://localhost:8003
MCP_CONTENT_URL=http://localhost:8004
ANALYTICS_TOKEN=your_analytics_token
CONTENT_TOKEN=your_content_token
```

### Connection Flow

1. **CLI starts** → loads environment variables
2. **Tool registry initializes** → connects to MCP servers
3. **Each server connection** is attempted with retry (3 attempts, exponential backoff)
4. **Tools are discovered** from connected servers
5. **Status is displayed** in CLI
6. **If connection fails** → CLI continues with native tools only

### CLI Commands

- `/mcp` - Show MCP server connection status
- `/tools` - List all available tools (native + MCP)
- `/health` - Check MCP server health and reconnect

### Example MCP Status Output

```text
🔌 MCP Server Status:
  ✅ motherduck: Connected
     URL: http://localhost:8001
     Tools: 5 available
  ❌ dice: Disconnected
     URL: http://localhost:8002

📊 Tool Registry Stats:
  Total Tools: 9
  Native: 4, MCP: 5
  Connected Servers: 1/2
```

### Tool Execution Tracking

When agents use tools, you'll see real-time execution details:

```text
🔧 motherduck calling tool: optimize_sql
   Arguments: {"sql": "SELECT * FROM sales"}
   ✓ optimize_sql completed (45ms)
   Result: "Optimized query: SELECT region, SUM(amount) FROM sales..."

🌐 motherduck calling tool: mcp_motherduck_query_database
   Arguments: {"query": "SELECT region, SUM(amount) FROM sales..."}
   ✓ mcp_motherduck_query_database completed (120ms)
```

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run security checks
safety check
bandit -r src/
```

## Deployment

Deployment to Fly.io happens automatically via GitHub Actions when you push to `main`:

- Triggers on changes to `services/agents/**`
- Monitor at: <https://github.com/omzification/hubble/actions>

### Manual Deployment (if needed)

```bash
cd services/agents
fly deploy

# View logs
fly logs

# Scale
fly scale count 2
```

But this is discouraged - use GitHub Actions for consistency.
