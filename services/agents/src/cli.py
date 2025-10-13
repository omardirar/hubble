#!/usr/bin/env python3
"""Interactive CLI for testing the iterative agent workflow using Click"""

import asyncio
import json
import logging
import os
import sys
import traceback
import uuid
from datetime import datetime
from functools import update_wrapper
from pathlib import Path
from typing import Any

import click

from .graph.workflow import IterativeAgentWorkflow

# =============================================================================
# Environment Configuration
# =============================================================================


def load_env_file() -> Path | None:
    """Load environment variables from multiple sources.

    Searches for .env files in the following order:
    1. services/agents/.env.local
    2. services/agents/.env
    3. workspace root .env.local
    4. workspace root .env

    Returns:
        Path to the loaded .env file, or None if not found
    """
    # Get the services/agents directory (parent of src)
    agents_dir = Path(__file__).parent.parent
    # Get the workspace root (parent of services)
    workspace_root = agents_dir.parent.parent

    env_files = [
        agents_dir / ".env.local",
        agents_dir / ".env",
        workspace_root / ".env.local",
        workspace_root / ".env",
    ]

    for env_file in env_files:
        if env_file.exists():
            click.echo(f"✓ Loading environment from {env_file}")
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        # Remove quotes and whitespace
                        value = value.strip().strip("\"'")
                        key = key.strip()
                        # Only set if not already in environment
                        if key not in os.environ:
                            os.environ[key] = value
            return env_file

    click.secho(
        "⚠ No .env file found - make sure environment variables are set", fg="yellow"
    )
    return None


def validate_environment() -> bool:
    """Validate required environment variables.

    Returns:
        True if all required variables are present, False otherwise
    """
    required_vars = ["ANTHROPIC_API_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        click.secho(
            f"❌ Missing environment variables: {', '.join(missing)}",
            fg="red",
            err=True,
        )
        return False
    return True


# =============================================================================
# Click Context Object
# =============================================================================


class CliConfig:
    """Configuration object passed through Click context."""

    def __init__(self, debug_mode: bool = False):
        self.debug_mode: bool = debug_mode
        self.show_thinking: bool = True
        self.raw_mode: bool = True
        self.test_mode: bool = False
        self.workflow: IterativeAgentWorkflow = IterativeAgentWorkflow()

        # Environment variables
        self.api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
        self.motherduck_token: str | None = os.getenv("MOTHERDUCK_TOKEN")
        self.database_name: str = os.getenv("DATABASE_NAME", "hubble_dev")
        self.mcp_server_url: str | None = os.getenv("MCP_SERVER_URL")

        # Logger instance
        self.logger = logging.getLogger(__name__)

        # Setup logging
        self._setup_logging()

    def _setup_logging(self) -> None:
        """Configure logging based on debug mode."""
        level = logging.DEBUG if self.debug_mode else logging.INFO

        # Set root logger level
        root_logger = logging.getLogger()
        root_logger.setLevel(level)

        # Ensure we have a console handler with proper formatting
        if not root_logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%H:%M:%S",
            )
            handler.setFormatter(formatter)
            root_logger.addHandler(handler)

        # Set level for all loggers in the services.agents namespace
        for logger_name in [
            "services.agents",
            "services.agents.mcp_client",
            "services.agents.config.tools",
            "services.agents.tools.registry",
            "services.agents.graph.workflow",
            "services.agents.supervisor",
        ]:
            logging.getLogger(logger_name).setLevel(level)

        self.logger.setLevel(level)

    def toggle_debug(self) -> None:
        """Toggle debug mode and update logging."""
        self.debug_mode = not self.debug_mode
        self._setup_logging()

        status = "enabled" if self.debug_mode else "disabled"
        click.secho(f"Debug mode: {status}", fg="cyan")
        if self.debug_mode:
            click.secho("Python logger level set to DEBUG", fg="cyan")
        else:
            click.secho("Python logger level set to INFO", fg="cyan")


# Custom decorator to pass config from context dict
# Reference: Context7 - "Custom Decorator using Context.invoke"
def pass_config(f: Any) -> Any:
    """Decorator that passes CliConfig from context dict to decorated function."""

    @click.pass_context
    def new_func(ctx: Any, *args: Any, **kwargs: Any) -> Any:
        config = ctx.obj.get("config")
        if config is None:
            raise click.ClickException("Configuration not initialized")
        return ctx.invoke(f, config, *args, **kwargs)

    return update_wrapper(new_func, f)


# =============================================================================
# Response Handling
# =============================================================================


async def save_final_response(final_response: Any, raw_mode: bool = False) -> None:
    """Save final response to responses folder for review with v1.3+ schema support.

    Args:
        final_response: The response object or dictionary to save
        raw_mode: If True, save raw response; if False, use human-readable format
    """
    responses_dir = Path(__file__).parent.parent.parent / "responses"
    responses_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Extract user message and run ID for filename
    if hasattr(final_response, "request"):
        user_message = (
            final_response.request.user_message[:50]
            if final_response.request.user_message
            else "unknown"
        )
        run_id = str(final_response.run.id)[:8] if final_response.run.id else "unknown"
    else:
        if "request" in final_response and "user_message" in final_response["request"]:
            user_message = final_response["request"]["user_message"][:50]
        elif "user_message" in final_response:
            user_message = final_response["user_message"][:50]
        else:
            user_message = "unknown"

        run_id = final_response.get("run", {}).get("id", "unknown")
        if isinstance(run_id, str) and len(run_id) > 8:
            run_id = run_id[:8]

    # Clean filename
    user_message = user_message.replace(" ", "_").replace("?", "").replace("!", "")
    filename = f"{timestamp}_{run_id}_{user_message}.json"
    file_path = responses_dir / filename

    if raw_mode:
        with open(file_path, "w", encoding="utf-8") as f:
            if hasattr(final_response, "model_dump_json"):
                f.write(final_response.model_dump_json(indent=2))
            else:
                json.dump(final_response, f, indent=2, ensure_ascii=False, default=str)
        click.secho(f"💾 Raw response saved to: {file_path}", fg="green")
    else:
        from .models.response_schema import FinalResponse
        from .utils.response_builder import serialize_for_file

        try:
            if hasattr(final_response, "model_dump_json"):
                file_data = serialize_for_file(final_response)
            else:
                response_model = FinalResponse.model_validate(final_response)
                file_data = serialize_for_file(response_model)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(file_data, f, indent=2, ensure_ascii=False)
            click.secho(f"💾 Response saved to: {file_path}", fg="green")

            # Show compression info
            if (
                hasattr(final_response, "messages")
                and final_response.messages.compression
            ):
                compression = final_response.messages.compression
                click.secho(
                    f"📦 Messages compressed with: {compression}",
                    fg="yellow",
                )
            elif (
                isinstance(final_response, dict)
                and "messages" in final_response
                and final_response["messages"].get("compression")
            ):
                compression = final_response["messages"]["compression"]
                click.secho(f"📦 Messages compressed with: {compression}", fg="cyan")

        except Exception as e:
            click.secho(
                f"⚠ Could not serialize as v1.3+ format, saving raw: {e}", fg="yellow"
            )
            with open(file_path, "w", encoding="utf-8") as f:
                if isinstance(final_response, dict):
                    json.dump(final_response, f, indent=2, ensure_ascii=False)
                else:
                    f.write(final_response.model_dump_json(indent=2))
            click.secho(f"💾 Raw response saved to: {file_path}", fg="green")


def create_mock_response(query: str) -> dict[str, Any]:
    """Create a mock response for test mode to avoid API calls.

    Args:
        query: The user query to create a mock response for

    Returns:
        A mock response dictionary following the v1.3+ schema
    """
    return {
        "schema_version": "1.3",
        "conversation": {
            "conversation_id": "test-session",
            "org_id": "test-org",
            "user_id": "test-user",
        },
        "request": {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "user_message": query,
            "requested_by": "user",
        },
        "run": {
            "id": str(uuid.uuid4()),
            "status": "succeeded",
            "started_at": datetime.utcnow().isoformat() + "Z",
            "completed_at": datetime.utcnow().isoformat() + "Z",
            "workflow": {
                "type": "multi_agent",
                "supervisor_agent": "supervisor",
                "sub_agents": [{"name": "marketer_agent", "as_tool": True}],
            },
        },
        "agents": [
            {
                "name": "supervisor",
                "role": "Supervisor agent that coordinates sub-agents",
                "model": {
                    "provider": "anthropic",
                    "name": "claude-3-5-sonnet-20241022",
                },
                "model_settings": {
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "top_p": 0.9,
                    "thinking": {"enabled": True, "budget_tokens": 10000},
                },
            }
        ],
        "routing": {
            "decider": "supervisor",
            "reason": "Test mode routing",
            "confidence": 1.0,
            "strategy": "rule_based",
        },
        "output": {"type": "text", "value": f"Mock response for: {query}"},
        "usage": {
            "requests": 1,
            "tool_calls": 0,
            "input_tokens": 50,
            "output_tokens": 100,
            "reasoning_tokens": 0,
            "cache_write_tokens": 0,
            "cache_read_tokens": 0,
            "input_audio_tokens": 0,
            "cache_audio_read_tokens": 0,
            "details": {},
        },
        "messages": {
            "format": "pydantic_ai.messages",
            "encoding": "base64",
            "scope": "new_run_only",
            "json": "eyJtZXNzYWdlcyI6IFtdfQ==",
            "sha256": (
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            ),
            "size_bytes": 15,
        },
        "events": [
            {
                "id": str(uuid.uuid4()),
                "seq": 1,
                "ts": datetime.utcnow().isoformat() + "Z",
                "source": {"agent": "system"},
                "type": "workflow_start",
                "data": {"event_type": "workflow_start", "entrypoint": "cli"},
            },
            {
                "id": str(uuid.uuid4()),
                "seq": 2,
                "ts": datetime.utcnow().isoformat() + "Z",
                "source": {"agent": "supervisor"},
                "type": "agent_run_started",
                "data": {"event_type": "agent_run_started"},
            },
            {
                "id": str(uuid.uuid4()),
                "seq": 3,
                "ts": datetime.utcnow().isoformat() + "Z",
                "source": {"agent": "supervisor"},
                "type": "text_completed",
                "data": {
                    "event_type": "text_completed",
                    "content": f"Mock response for: {query}",
                    "model_name": "claude-3-5-sonnet-20241022",
                    "provider_name": "anthropic",
                    "provider_response_id": f"test-{uuid.uuid4()}",
                    "usage": {
                        "input_tokens": 50,
                        "output_tokens": 100,
                        "reasoning_tokens": 0,
                        "cache_write_tokens": 0,
                        "cache_read_tokens": 0,
                        "input_audio_tokens": 0,
                        "cache_audio_read_tokens": 0,
                        "details": {},
                    },
                },
            },
            {
                "id": str(uuid.uuid4()),
                "seq": 4,
                "ts": datetime.utcnow().isoformat() + "Z",
                "source": {"agent": "system"},
                "type": "workflow_complete",
                "data": {
                    "event_type": "workflow_complete",
                    "status": "succeeded",
                    "total_events": 4,
                },
            },
        ],
        "mcp": {"servers": [], "sessions": []},
        "policy": {
            "thinking_visibility": "full",
            "pii_filter": False,
            "policy_version": "1.0",
        },
    }


# =============================================================================
# Display Utilities
# =============================================================================


def display_response(final_response: dict[str, Any]) -> None:
    """Display the final response from the workflow.

    Args:
        final_response: The response dictionary to display
    """
    click.secho("\n✅ Workflow completed successfully!", fg="green", bold=True)

    # Display final response
    if "output" in final_response and "value" in final_response["output"]:
        click.secho("\nFinal Response:", bold=True)
        click.secho(final_response["output"]["value"], fg="green")

    # Display token usage
    if "usage" in final_response:
        usage = final_response["usage"]
        click.secho("\nToken Usage:", fg="cyan")
        click.echo(f"  Input: {usage.get('input_tokens', 0)}")
        click.echo(f"  Output: {usage.get('output_tokens', 0)}")
        click.echo(f"  Reasoning: {usage.get('reasoning_tokens', 0)}")
        click.echo(f"  Cache Write: {usage.get('cache_write_tokens', 0)}")
        click.echo(f"  Cache Read: {usage.get('cache_read_tokens', 0)}")
        total_tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        click.echo(f"  Total: {total_tokens}")

        if usage.get("details"):
            click.secho("\nProvider Details:", fg="cyan")
            for provider, details in usage["details"].items():
                click.echo(f"  {provider}: {details}")

    # Display routing information
    if "routing" in final_response:
        routing = final_response["routing"]
        click.secho("\nRouting Decision:", fg="blue")
        click.echo(f"  Decider: {routing.get('decider', 'unknown')}")
        click.echo(f"  Reason: {routing.get('reason', 'unknown')}")
        click.echo(f"  Confidence: {routing.get('confidence', 0):.2f}")
        if "strategy" in routing:
            click.echo(f"  Strategy: {routing['strategy']}")

    # Display MCP information
    if final_response.get("mcp"):
        mcp = final_response["mcp"]
        if mcp.get("servers"):
            click.secho("\nMCP Servers:", fg="blue")
            for server in mcp["servers"]:
                name = server.get("name", "unknown")
                transport = server.get("transport", "unknown")
                click.secho(f"  • {name} ({transport})")
        if mcp.get("sessions"):
            click.secho("\nMCP Sessions:", fg="blue")
            for session in mcp["sessions"]:
                status = "active" if not session.get("closed_at") else "closed"
                session_id = session.get("session_id", "unknown")
                if hasattr(session_id, "__str__"):
                    session_id = str(session_id)[:8]
                click.echo(f"  • {session_id}: {status}")

    # Display events summary
    if final_response.get("events"):
        events = final_response["events"]
        click.secho("\nEvents Summary:", fg="cyan")
        click.echo(f"  Total events: {len(events)}")

        event_types: dict[str, int] = {}
        for event in events:
            event_type = event.get("type", "unknown")
            event_types[event_type] = event_types.get(event_type, 0) + 1

        for event_type, count in event_types.items():
            click.echo(f"  {event_type}: {count}")


async def display_mcp_status() -> None:
    """Display MCP connection status."""
    from .tools.registry import get_registry

    registry = get_registry()
    servers = registry.get_mcp_servers()
    stats = registry.get_tool_stats()

    click.secho("\n🔌 MCP Server Status:", bold=True)

    if not servers:
        click.secho("  No MCP servers configured", fg="yellow")
        click.secho("  Using native tools only", fg="cyan")
        return

    for name, config in servers.items():
        connected = config.get("connected")
        status_icon = "✅" if connected else "❌"
        status_text = "Connected" if connected else "Disconnected"
        color = "green" if connected else "red"
        click.secho(
            f"  {status_icon} {name}: {status_text} ({config.get('url', 'unknown')})",
            fg=color,
        )

    click.secho(f"\n📊 Registry Stats: {stats}", fg="cyan")


async def list_available_tools() -> None:
    """List all available tools from the registry."""
    from .tools.registry import get_registry

    registry = get_registry()
    tools = registry.list_tools()

    click.secho(f"\n🔧 Available Tools ({len(tools)}):", bold=True)

    # Group by source
    native_tools = [t for t in tools if t.source == "native"]
    mcp_tools = [t for t in tools if t.source == "mcp"]

    if native_tools:
        click.secho("\nNative Tools:", fg="green")
        for tool in native_tools:
            click.echo(f"  • {tool.name}: {tool.description}")

    if mcp_tools:
        click.secho("\nMCP Tools:", fg="blue")
        for tool in mcp_tools:
            server_name = tool.mcp_server or "unknown"
            click.echo(f"  • {tool.name} ({server_name}): {tool.description}")


# =============================================================================
# Workflow Execution
# =============================================================================


async def run_workflow(
    config: CliConfig,
    query: str,
) -> None:
    """Run the workflow with the given query using v1.3+ schema.

    Args:
        config: CLI configuration object
        query: User query to process
    """
    try:
        click.secho("🔄 Processing your request..", fg="cyan")
        config.logger.debug(
            "Starting workflow execution: query=%s, motherduck_token_available=%s, "
            "database_name=%s, mcp_server_url=%s, raw_mode=%s",
            query,
            bool(config.motherduck_token),
            config.database_name,
            config.mcp_server_url,
            config.raw_mode,
        )

        # Check for test mode
        test_env = os.getenv("AGENTS_TEST_MODE", "").lower()
        if config.test_mode or test_env in ("true", "1", "yes"):
            click.secho(
                "🧪 Running in TEST MODE - no API calls will be made", fg="yellow"
            )
            final_response = create_mock_response(query)
        else:
            try:
                from .agents.supervisor import run_supervisor_workflow
            except ImportError as e:
                click.secho(f"Failed to import supervisor: {e}", fg="red", err=True)
                click.secho("Falling back to mock response", fg="yellow")
                final_response = create_mock_response(query)
                await save_final_response(final_response, raw_mode=config.raw_mode)
                return

            # Run the v1.3+ supervisor workflow
            final_response = await run_supervisor_workflow(
                user_message=query,
                conversation_id="cli-session",
                org_id="cli-org",
                user_id="cli-user",
                motherduck_token=config.motherduck_token,
                database_name=config.database_name,
                mcp_server_url=config.mcp_server_url,
                requested_by="user",
                policy_version="1.0",
                compress_messages=not config.raw_mode,
            )

        # Display and save the response
        if final_response:
            display_response(final_response)
            await save_final_response(final_response, raw_mode=config.raw_mode)
        else:
            click.secho("⚠ No final response generated", fg="yellow")

    except ImportError as e:
        click.secho(f"❌ Module import failed: {e}", fg="red", err=True)
        click.secho("⚠ Falling back to mock response", fg="yellow")
        final_response = create_mock_response(query)
        await save_final_response(final_response, raw_mode=config.raw_mode)
    except Exception as e:
        click.secho(f"❌ Workflow error: {e!s}", fg="red", err=True)
        config.logger.error(
            "Workflow error: %s (type: %s)",
            str(e),
            type(e).__name__,
            exc_info=config.debug_mode,
        )
        if config.debug_mode:
            click.secho("\nFull traceback:", fg="red", err=True)
            click.echo(traceback.format_exc(), err=True)


# =============================================================================
# Click Commands
# =============================================================================


@click.group(invoke_without_command=True)
@click.option(
    "--debug/--no-debug",
    default=True,
    help="Enable debug mode with detailed logging",
    show_default=True,
)
@click.option(
    "--raw/--no-raw",
    default=True,
    help="Save raw responses without compression",
    show_default=True,
)
@click.option(
    "--test/--no-test",
    default=False,
    help="Run in test mode (no API calls, mock responses)",
    show_default=True,
)
@click.pass_context
def cli(ctx: Any, debug: bool, raw: bool, test: bool) -> None:
    """Hubble Supervisor Agent Workflow CLI

    Interactive command-line interface for testing the iterative agent workflow.
    Run without arguments to enter interactive mode.
    """
    # Ensure context object exists and is a dict - Click best practice
    # Reference: Context7 - "Nested Command Context Handling"
    ctx.ensure_object(dict)

    # Initialize or get config from context
    if not isinstance(ctx.obj.get("config"), CliConfig):
        ctx.obj["config"] = CliConfig(debug_mode=debug)

    config = ctx.obj["config"]

    # Apply command-line options (in case config was already initialized)
    if config.debug_mode != debug:
        config.debug_mode = debug
        config._setup_logging()

    config.raw_mode = raw
    config.test_mode = test
    config._setup_logging()

    # If no subcommand, enter interactive mode
    if ctx.invoked_subcommand is None:
        ctx.invoke(interactive)


@cli.command()
@pass_config
def interactive(config: CliConfig) -> None:
    """Enter interactive mode for chatting with the agent."""
    top_border = "╔" + "═" * 54 + "╗"
    title = "║     Hubble Supervisor Agent Workflow CLI              ║"
    bottom_border = "╚" + "═" * 54 + "╝"
    click.secho(top_border, fg="magenta")
    click.secho(title, fg="magenta")
    click.secho(bottom_border, fg="magenta")

    # Check environment
    if not config.api_key:
        click.secho("❌ ANTHROPIC_API_KEY not set", fg="red", err=True)
        raise click.Abort()

    config.logger.debug("API key found (length: %d)", len(config.api_key))

    # Check MotherDuck integration
    if config.motherduck_token:
        click.secho("✓ MotherDuck integration enabled", fg="green")
    else:
        click.secho(
            "⚠ MotherDuck integration disabled (MOTHERDUCK_TOKEN not set)", fg="yellow"
        )

    # Display help
    click.echo("\nCommands:")
    click.echo("  Type your message to interact with the agent")
    click.echo("  Use Ctrl+D or type 'exit' to quit")
    click.echo("  Type 'help' for more commands")

    # Initialize tool registry
    asyncio.run(_initialize_tools(config))
    asyncio.run(display_mcp_status())

    # Interactive loop
    asyncio.run(_interactive_loop(config))


def _suppress_mcp_task_exceptions(loop: Any, context: dict[str, Any]) -> None:
    """Custom exception handler to suppress expected MCP SDK task exceptions."""
    exception = context.get("exception")

    # Suppress expected anyio/MCP SDK cleanup errors
    if isinstance(exception, RuntimeError):
        error_msg = str(exception).lower()
        if "cancel scope" in error_msg or "different task" in error_msg:
            # This is expected during MCP SDK cleanup - suppress it
            return

    # Suppress connection errors from background tasks (already logged)
    if isinstance(exception, ConnectionError | OSError):
        return

    # For all other exceptions, use default handling
    loop.default_exception_handler(context)


async def _initialize_tools(config: CliConfig) -> None:
    """Initialize the tool registry asynchronously."""
    config.logger.debug("Initializing tool registry asynchronously...")
    from .config.tools import initialize_tools_once

    # Install custom exception handler to suppress MCP SDK task exceptions
    loop = asyncio.get_event_loop()
    old_exception_handler = loop.get_exception_handler()
    loop.set_exception_handler(_suppress_mcp_task_exceptions)

    try:
        # Increased timeout from 30s to 60s to accommodate slower MCP server connections
        await asyncio.wait_for(initialize_tools_once(), timeout=60.0)
        config.logger.debug("Tool registry initialization complete")
    except TimeoutError:
        config.logger.warning("Tool registry initialization timed out after 60s")
        click.secho("⚠ Tool registry initialization timed out after 60s", fg="yellow")
        click.secho("  Continuing with limited functionality..", fg="cyan")
    except asyncio.CancelledError:
        config.logger.warning("Tool registry initialization was cancelled")
        click.secho("⚠ Tool registry initialization was cancelled", fg="yellow")
        click.secho("  Continuing with limited functionality..", fg="cyan")
    except Exception as e:
        config.logger.error("Tool registry initialization error: %s", str(e))
        click.secho(f"⚠ Tool registry initialization failed: {e}", fg="yellow")
        click.secho("  Continuing with limited functionality..", fg="cyan")
    finally:
        # Restore original exception handler
        loop.set_exception_handler(old_exception_handler)


async def _interactive_loop(config: CliConfig) -> None:
    """Run the main interactive loop."""
    while True:
        try:
            user_input = click.prompt(
                click.style("You", bold=True),
                prompt_suffix=": ",
                default="",
                show_default=False,
                err=False,
            ).strip()

            if not user_input:
                continue

            # Handle commands
            if user_input.lower() in ("exit", "quit"):
                click.secho("Goodbye! 👋", fg="cyan")
                break

            if user_input.lower() == "help":
                _show_help()
                continue

            if user_input.lower() == "clear":
                click.clear()
                continue

            if user_input.lower() == "debug":
                config.toggle_debug()
                continue

            if user_input.lower() == "thinking on":
                config.show_thinking = True
                click.secho("Agent reasoning display: enabled", fg="cyan")
                continue

            if user_input.lower() == "thinking off":
                config.show_thinking = False
                click.secho("Agent reasoning display: disabled", fg="cyan")
                continue

            if user_input.lower() == "raw on":
                config.raw_mode = True
                click.secho(
                    "Raw mode: enabled (no compression, binary bytes omitted)",
                    fg="cyan",
                )
                continue

            if user_input.lower() == "raw off":
                config.raw_mode = False
                click.secho("Raw mode: disabled (compressed format)", fg="cyan")
                continue

            if user_input.lower() == "test on":
                config.test_mode = True
                click.secho("Test mode: enabled (no API calls)", fg="cyan")
                continue

            if user_input.lower() == "test off":
                config.test_mode = False
                click.secho("Test mode: disabled", fg="cyan")
                continue

            if user_input.lower() == "mcp":
                await display_mcp_status()
                continue

            if user_input.lower() == "tools":
                await list_available_tools()
                continue

            if user_input.lower() == "health":
                await _check_health()
                continue

            # Execute workflow for actual user input
            config.logger.debug(
                "Executing workflow for user input: %s "
                "(motherduck_token_available=%s, database_name=%s, mcp_server_url=%s)",
                user_input,
                bool(config.motherduck_token),
                config.database_name,
                config.mcp_server_url,
            )

            await run_workflow(config, user_input)
            click.echo()  # Add spacing

        except (EOFError, KeyboardInterrupt):
            click.secho("\nGoodbye! 👋", fg="cyan")
            break
        except Exception as e:
            config.logger.error(
                "Unexpected error in interactive mode: %s (type: %s)",
                str(e),
                type(e).__name__,
                exc_info=config.debug_mode,
            )
            click.secho(f"Unexpected error: {e}", fg="red", err=True)


def _show_help() -> None:
    """Display help information."""
    click.secho("\nAvailable Commands:", bold=True)
    click.secho("  exit, quit", fg="green")
    click.echo("     - Exit the CLI")
    click.secho("  help", fg="green")
    click.echo("     - Show this help message")
    click.secho("  clear", fg="green")
    click.echo("     - Clear the screen")
    click.secho("  thinking on/off", fg="green")
    click.echo("     - Toggle agent reasoning display")
    click.secho("  debug", fg="green")
    click.echo("     - Toggle debug mode (shows detailed logs)")
    click.secho("  mcp", fg="green")
    click.echo("     - Show MCP server status")
    click.secho("  tools", fg="green")
    click.echo("     - List available tools")
    click.secho("  health", fg="green")
    click.echo("     - Check MCP server health and reconnect")
    click.secho("  raw on/off", fg="green")
    click.echo("     - Toggle raw mode (no compression)")
    click.secho("  test on/off", fg="green")
    click.echo("     - Toggle test mode (no API calls)")


async def _check_health() -> None:
    """Check MCP server health and reconnect if needed."""
    click.secho("\n🏥 Running MCP Health Check..", bold=True)

    from .config.tools import refresh_mcp_connections

    await refresh_mcp_connections()
    await display_mcp_status()


@cli.command()
@click.argument("query")
@pass_config
def ask(config: CliConfig, query: str) -> None:
    """Ask the agent a single question and exit.

    QUERY: The question or prompt to send to the agent
    """
    asyncio.run(_ask_once(config, query))


async def _ask_once(config: CliConfig, query: str) -> None:
    """Execute a single query and exit."""
    await _initialize_tools(config)
    await run_workflow(config, query)


@cli.command()
@pass_config
def status(config: CliConfig) -> None:
    """Show current configuration and MCP status."""
    click.secho("\n⚙️  Configuration:", bold=True)
    click.echo(f"  Debug mode: {config.debug_mode}")
    click.echo(f"  Show thinking: {config.show_thinking}")
    click.echo(f"  Raw mode: {config.raw_mode}")
    click.echo(f"  Test mode: {config.test_mode}")
    click.echo(f"  Database: {config.database_name}")
    click.echo(f"  API Key: {'✓' if config.api_key else '✗'}")
    click.echo(f"  MotherDuck Token: {'✓' if config.motherduck_token else '✗'}")
    click.echo(f"  MCP Server URL: {config.mcp_server_url or 'Not set'}")

    asyncio.run(display_mcp_status())


@cli.command()
def version() -> None:
    """Show CLI version information."""
    click.secho("Hubble Supervisor Agent Workflow CLI", bold=True)
    click.echo("Version: 2.0.0 (Click-based)")
    click.echo("Schema Version: 1.3+")


# =============================================================================
# Main Entry Point
# =============================================================================


def main() -> None:
    """Main entry point for the CLI."""
    # Load environment variables from .env files
    load_env_file()

    # Validate required environment variables
    if not validate_environment():
        sys.exit(1)

    # Run the Click CLI
    cli()


if __name__ == "__main__":
    main()
