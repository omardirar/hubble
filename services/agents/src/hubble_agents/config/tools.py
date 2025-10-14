"""Tool registry configuration and initialization"""

import asyncio
import os
from typing import Any

from ..tools.registry import get_registry, register_native_tool
from ..utils.logging import get_logger
from .validation import (
    MCPClientConfig,
    get_config_summary,
    load_mcp_config,
    validate_global_config,
)

logger = get_logger(__name__)


async def initialize_tools() -> None:
    """Initialize tool registry with MCP servers and native tools"""
    registry = get_registry()

    logger.debug("Initializing tool registry...")

    # Load and validate MCP configuration
    config: MCPClientConfig | None = None
    try:
        config = load_mcp_config()
        if config and config.servers:
            logger.debug(f"Loaded {len(config.servers)} MCP server configurations")
            issues = validate_global_config(config)

            if issues:
                logger.warning(f"MCP configuration issues: {issues}")
            else:
                logger.debug(
                    f"MCP configuration validated: {get_config_summary(config)}"
                )
        else:
            logger.warning("No MCP servers configured in environment variables")
            config = None
    except Exception as e:
        logger.error(f"Failed to load MCP configuration: {e}", exc_info=True)
        config = None

    # Register MCP servers and await connections
    if config and config.servers:
        await _register_mcp_servers_from_config(registry, config)
    else:
        # Fallback to environment variable approach
        await _register_mcp_servers(registry)

    # Register native tools
    _register_native_tools(registry)

    # Log initialization summary
    stats = registry.get_tool_stats()
    logger.debug(f"Tool registry initialized: {stats}")


# Global initialization state
_init_lock = asyncio.Lock()
_init_future: asyncio.Future[None] | None = None


async def initialize_tools_once() -> None:
    """Initialize tools once (idempotent)"""
    global _init_future
    async with _init_lock:
        if _init_future is None:
            _init_future = asyncio.create_task(initialize_tools())
        return await _init_future


def initialize_tools_sync() -> None:
    """Synchronous wrapper for tool initialization"""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in async context - schedule initialization as a task
            logger.debug(
                "Tool initialization called from async context - scheduling as task"
            )
            _ = asyncio.create_task(initialize_tools())  # noqa: RUF006
            # Initialization is in progress
        else:
            # Not in async context - run directly
            asyncio.run(initialize_tools())
    except RuntimeError:
        # No event loop - create new one
        asyncio.run(initialize_tools())


async def _register_mcp_servers(registry: Any) -> None:
    """Register MCP servers from environment variables"""

    logger.debug("🔧 Starting MCP server registration...")

    # Debug environment variables
    env_vars = {
        "MCP_MOTHERDUCK_URL": os.getenv("MCP_MOTHERDUCK_URL"),
        "MOTHERDUCK_TOKEN": "***" if os.getenv("MOTHERDUCK_TOKEN") else None,
        "DATABASE_NAME": os.getenv("DATABASE_NAME"),
        "MCP_ANALYTICS_URL": os.getenv("MCP_ANALYTICS_URL"),
        "MCP_CONTENT_URL": os.getenv("MCP_CONTENT_URL"),
        "ANALYTICS_TOKEN": "***" if os.getenv("ANALYTICS_TOKEN") else None,
        "CONTENT_TOKEN": "***" if os.getenv("CONTENT_TOKEN") else None,
    }

    logger.debug(f"Environment variables for MCP servers: {env_vars}")

    servers_to_register = []

    # MotherDuck MCP server
    motherduck_url: str = os.getenv("MCP_MOTHERDUCK_URL", "http://127.0.0.1:8001")
    motherduck_token: str | None = os.getenv("MOTHERDUCK_TOKEN")
    motherduck_db: str = os.getenv("DATABASE_NAME", "hubble_dev")

    token_display = "***" if motherduck_token else "None"
    logger.debug(
        f"🦆 MotherDuck server config: url={motherduck_url}, "
        f"token={token_display}, db={motherduck_db}"
    )

    servers_to_register.append(
        {
            "name": "motherduck",
            "url": motherduck_url,
            "token": motherduck_token,
            "database": motherduck_db,
        }
    )

    # Analytics MCP server (optional)
    analytics_url: str | None = os.getenv("MCP_ANALYTICS_URL")
    analytics_token: str | None = os.getenv("ANALYTICS_TOKEN")

    if analytics_url:
        token_display = "***" if analytics_token else "None"
        logger.debug(
            f"📊 Analytics server config: url={analytics_url}, token={token_display}"
        )
        servers_to_register.append(
            {
                "name": "analytics",
                "url": analytics_url,
                "token": analytics_token,
                "database": None,
            }
        )
    else:
        logger.debug("📊 Analytics server not configured (MCP_ANALYTICS_URL not set)")

    # Content MCP server (optional)
    content_url: str | None = os.getenv("MCP_CONTENT_URL")
    content_token: str | None = os.getenv("CONTENT_TOKEN")

    if content_url:
        token_display = "***" if content_token else "None"
        logger.debug(
            f"📝 Content server config: url={content_url}, token={token_display}"
        )
        servers_to_register.append(
            {
                "name": "content",
                "url": content_url,
                "token": content_token,
                "database": None,
            }
        )
    else:
        logger.debug("📝 Content server not configured (MCP_CONTENT_URL not set)")

    logger.debug(f"🚀 Registering {len(servers_to_register)} MCP servers...")

    # Register all servers in parallel
    tasks = []
    for server_config in servers_to_register:
        name_val: Any = server_config.get("name")
        url_val: Any = server_config.get("url")
        if not name_val or not url_val:
            logger.warning(f"Skipping invalid server config: {server_config}")
            continue

        timeout_val: Any = server_config.get("timeout", 30)
        max_retries_val: Any = server_config.get("max_retries", 3)
        connection_timeout_val: Any = server_config.get(
            "connection_timeout", 60
        )  # Increased to 60s
        read_timeout_val: Any = server_config.get("read_timeout", 30)

        task = _register_single_server(
            registry,
            name=str(name_val),
            url=str(url_val),
            token=server_config.get("token")
            if isinstance(server_config.get("token"), str)
            else None,
            database=server_config.get("database")
            if isinstance(server_config.get("database"), str)
            else None,
            timeout=int(timeout_val) if isinstance(timeout_val, int | str) else 30,
            max_retries=int(max_retries_val)
            if isinstance(max_retries_val, int | str)
            else 3,
            connection_timeout=int(connection_timeout_val)
            if isinstance(connection_timeout_val, int | str)
            else 60,  # Increased default from 10 to 60
            read_timeout=int(read_timeout_val)
            if isinstance(read_timeout_val, int | str)
            else 30,
        )
        tasks.append(task)

    # Wait for all registrations (with individual error handling)
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Log results
    for i, result in enumerate(results):
        server_name = servers_to_register[i]["name"]
        if isinstance(result, Exception):
            logger.error(f"❌ Failed to register {server_name}: {result}")
        else:
            logger.debug(f"✅ Successfully registered {server_name}")

    logger.debug("🔧 MCP server registration complete")


async def _register_mcp_servers_from_config(registry: Any, config: Any) -> None:
    """Register MCP servers from validated configuration"""
    logger.debug("🔧 Starting MCP server registration from config...")

    servers_to_register: list[dict[str, Any]] = []
    for server_config in config.servers:
        servers_to_register.append(
            {
                "name": server_config.name,
                "url": str(server_config.url),
                "token": server_config.token,
                "database": server_config.database,
                "timeout": server_config.timeout,
                "max_retries": server_config.max_retries,
                "connection_timeout": server_config.connection_timeout,
                "read_timeout": server_config.read_timeout,
            }
        )

    logger.debug(
        f"🚀 Registering {len(servers_to_register)} MCP servers from config..."
    )

    # Register all servers in parallel with concurrency limit
    semaphore = asyncio.Semaphore(3)  # Max 3 concurrent registrations

    async def register_with_limit(server_config: dict[str, Any]) -> bool:
        async with semaphore:
            return await _register_single_server(registry, **server_config)

    tasks = [register_with_limit(cfg) for cfg in servers_to_register]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Log results
    for i, result in enumerate(results):
        server_name = servers_to_register[i]["name"]
        if isinstance(result, Exception):
            logger.error(f"❌ Failed to register {server_name}: {result}")
        else:
            logger.debug(f"✅ Successfully registered {server_name}")

    logger.debug("🔧 MCP server registration from config complete")


async def _register_single_server(
    registry: Any,
    name: str,
    url: str,
    token: str | None = None,
    database: str | None = None,
    timeout: int = 30,
    max_retries: int = 3,
    connection_timeout: int = 30,  # Increased from 10 to 30 seconds
    read_timeout: int = 30,
) -> bool:
    """Register a single MCP server with error handling"""
    logger.debug(f"🔌 Attempting to register {name} MCP server at {url}")

    try:
        # Add timeout to prevent hanging on connection - increased timeout
        await asyncio.wait_for(
            registry.register_mcp_server_async(
                name=name, url=url, token=token, database=database
            ),
            timeout=connection_timeout,
        )
        logger.debug(f"✅ Successfully registered {name} MCP server: {url}")
        return True
    except TimeoutError:
        logger.warning(
            f"⏰ Timeout connecting to {name} MCP server at {url} "
            f"(waited {connection_timeout}s)"
        )
        return False
    except asyncio.CancelledError:
        logger.warning(f"⚠️ Connection to {name} MCP server was cancelled")
        return False
    except ConnectionError as e:
        logger.warning(
            f"⚠️ Cannot connect to {name} MCP server at {url} - is it running?"
        )
        logger.debug(f"   Connection error details: {e}")
        return False
    except OSError as e:
        logger.warning(f"⚠️ Network error connecting to {name} MCP server at {url}")
        logger.debug(f"   OS error details: {e}")
        return False
    except Exception as e:
        logger.warning(f"⚠️ Failed to register {name} MCP server: {e}")
        logger.debug(f"   URL: {url}")
        logger.debug(f"   Token: {'***' if token else 'None'}")
        logger.debug(f"   Database: {database}")
        logger.debug(f"   Error type: {type(e).__name__}")
        # Continue execution - agent will work with native tools only
        return False


def _register_native_tools(registry: Any) -> None:
    """Register native tools for agents"""

    # SQL optimization tool for MotherDuck agent
    def optimize_sql_query(sql: str) -> str:
        """Optimize a SQL query for better performance"""
        # Basic SQL optimization logic
        optimized = sql.strip()

        # Add common optimizations
        if "SELECT *" in optimized.upper():
            optimized = optimized.replace("SELECT *", "SELECT specific_columns")

        if "ORDER BY" in optimized.upper() and "LIMIT" not in optimized.upper():
            optimized += " LIMIT 1000"  # Add reasonable limit

        return f"Optimized query: {optimized}"

    register_native_tool(
        name="optimize_sql",
        description="Optimize SQL queries for better performance",
        function=optimize_sql_query,
        schema={
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "SQL query to optimize"}
            },
            "required": ["sql"],
        },
        agent_name="motherduck",
    )

    # Query explanation tool for MotherDuck agent
    def explain_query_results(results: str) -> str:
        """Explain query results in business terms"""
        # Basic explanation logic
        if not results or results.strip() == "":
            return "No results to explain."

        lines = results.split("\n")
        row_count = len([line for line in lines if line.strip()])

        explanation = f"Query returned {row_count} rows of data. "

        if row_count > 1000:
            explanation += (
                "This is a large dataset that may benefit from "
                "filtering or aggregation."
            )
        elif row_count > 100:
            explanation += "This is a moderate-sized dataset suitable for analysis."
        else:
            explanation += "This is a small dataset that's easy to work with."

        return explanation

    register_native_tool(
        name="explain_results",
        description="Explain query results in business terms",
        function=explain_query_results,
        schema={
            "type": "object",
            "properties": {
                "results": {"type": "string", "description": "Query results to explain"}
            },
            "required": ["results"],
        },
        agent_name="motherduck",
    )

    # Content analysis tool for marketing agent
    def analyze_content_quality(content: str) -> str:
        """Analyze content quality and provide suggestions"""
        word_count = len(content.split())

        analysis = f"Content analysis: {word_count} words. "

        if word_count < 100:
            analysis += (
                "Content is quite short. Consider adding more detail or examples."
            )
        elif word_count < 500:
            analysis += "Content length is good for social media or brief explanations."
        elif word_count < 1500:
            analysis += (
                "Content length is ideal for blog posts or detailed explanations."
            )
        else:
            analysis += (
                "Content is comprehensive. Consider breaking into sections "
                "or creating a series."
            )

        # Check for common issues
        if content.count(".") < 3:
            analysis += " Consider adding more detailed explanations."

        if "?" not in content:
            analysis += " Consider adding questions to engage readers."

        return analysis

    register_native_tool(
        name="analyze_content",
        description="Analyze content quality and provide suggestions",
        function=analyze_content_quality,
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Content to analyze"}
            },
            "required": ["content"],
        },
        agent_name="direct",
    )

    # Response quality assessment tool for reviewer agent
    def assess_response_quality(response: str, query: str) -> dict[str, Any]:
        """Assess the quality of an agent response"""
        word_count = len(response.split())
        query_words = len(query.split())

        # Calculate completeness score
        completeness = min(1.0, word_count / (query_words * 10))

        # Calculate clarity score (basic heuristic)
        clarity = 0.8  # Base score
        if word_count > 50:
            clarity += 0.1
        if "." in response:
            clarity += 0.1

        # Calculate relevance score
        relevance = 0.7  # Base score
        query_lower = query.lower()
        response_lower = response.lower()

        # Check for keyword overlap
        query_keywords = set(query_lower.split())
        response_keywords = set(response_lower.split())
        overlap = len(query_keywords.intersection(response_keywords))
        if overlap > 0:
            relevance += min(0.3, overlap * 0.1)

        overall_score = (completeness + clarity + relevance) / 3

        return {
            "overall_score": overall_score,
            "completeness": completeness,
            "clarity": clarity,
            "relevance": relevance,
            "word_count": word_count,
            "suggestions": _generate_quality_suggestions(
                overall_score, completeness, clarity, relevance
            ),
        }

    def _generate_quality_suggestions(
        overall: float, completeness: float, clarity: float, relevance: float
    ) -> list[str]:
        suggestions = []

        if overall < 0.6:
            suggestions.append("Response needs significant improvement")
        if completeness < 0.5:
            suggestions.append("Add more detail to fully address the query")
        if clarity < 0.7:
            suggestions.append("Improve clarity and structure")
        if relevance < 0.6:
            suggestions.append("Focus more on the specific query topic")

        return suggestions

    register_native_tool(
        name="assess_quality",
        description="Assess the quality of an agent response",
        function=assess_response_quality,
        schema={
            "type": "object",
            "properties": {
                "response": {"type": "string", "description": "Response to assess"},
                "query": {"type": "string", "description": "Original query"},
            },
            "required": ["response", "query"],
        },
        agent_name="reviewer",
    )


def get_tool_configuration() -> dict[str, Any]:
    """Get current tool configuration"""
    registry = get_registry()

    return {
        "registry_stats": registry.get_tool_stats(),
        "mcp_servers": registry.get_mcp_servers(),
        "available_tools": [
            {
                "name": tool.name,
                "description": tool.description,
                "source": tool.source,
                "agent": agent_name,
            }
            for tool in registry.list_tools()
            for agent_name, tool_names in registry.agent_tools.items()
            if tool.name in tool_names
        ],
    }


async def refresh_mcp_connections() -> None:
    """Refresh connections to MCP servers"""
    registry = get_registry()

    logger.debug("Refreshing MCP server connections...")

    # Get current server configurations
    servers = registry.get_mcp_servers()

    if not servers:
        logger.debug("No MCP servers configured")
        return

    # Attempt to reconnect to each server
    for server_name, config in servers.items():
        try:
            logger.debug(f"Attempting to reconnect to {server_name}...")

            # Create a new MCP client to test connection
            from ..mcp_client.client import MCPClient

            async with MCPClient(
                url=config["url"],
                token=config.get("token"),
                database=config.get("database"),
            ) as client:
                # Health check will ensure list_tools succeeds
                if await client.health_check():
                    registry.update_server_status(server_name, connected=True)
                    logger.debug(f"Successfully reconnected to {server_name}")
                else:
                    registry.update_server_status(server_name, connected=False)
                    logger.warning(f"Failed to reconnect to {server_name}")

        except Exception as e:
            logger.error(f"Error reconnecting to {server_name}: {e}")
            registry.update_server_status(server_name, connected=False)

    # Log final status
    stats = registry.get_tool_stats()
    connected = stats["connected_mcp_servers"]
    total = stats["total_mcp_servers"]
    logger.debug(f"Connection refresh complete: {connected}/{total} servers connected")
