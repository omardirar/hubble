"""Minimal CLI for running the supervisor agent from the terminal."""

from __future__ import annotations

import asyncio
import uuid

import click

from .agents import SupervisorDeps, create_supervisor_agent
from .config.settings import validate_environment


@click.command()
@click.option(
    "--prompt", prompt="Enter a prompt", help="User message to send to the supervisor agent."
)
@click.option("--org-id", default="cli-org", show_default=True)
@click.option("--user-id", default="cli-user", show_default=True)
@click.option("--conversation-id", default=None, help="Optional conversation identifier.")
def main(prompt: str, org_id: str, user_id: str, conversation_id: str | None) -> None:
    """Execute a single supervisor agent run from the command line."""

    settings = validate_environment()
    agent = create_supervisor_agent(settings)
    conversation = conversation_id or str(uuid.uuid4())
    deps = SupervisorDeps(
        settings=settings,
        org_id=org_id,
        user_id=user_id,
        conversation_id=conversation,
        motherduck_url=settings.mcp.motherduck_url,
        motherduck_token=settings.mcp.motherduck_token.get_secret_value()
        if settings.mcp.motherduck_token
        else None,
        database_name=settings.mcp.database_name,
        run_id=f"cli_{uuid.uuid4().hex[:8]}",
        streaming=None,
    )

    async def _run() -> None:
        result = await agent.run(prompt, deps=deps)
        click.echo()
        click.echo(click.style("Supervisor response:", fg="cyan"))
        click.echo(result.output)

    asyncio.run(_run())


if __name__ == "__main__":
    main()
