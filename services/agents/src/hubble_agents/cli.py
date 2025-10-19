"""Simple CLI runner for the authenticated crew."""

from __future__ import annotations

import click

from .config.settings import validate_environment
from .crew import AuthenticatedSupportCrew


@click.command()
@click.option("--prompt", prompt="Enter a prompt", help="User message to process.")
@click.option("--org-id", default="cli-org", show_default=True)
@click.option("--user-id", default="cli-user", show_default=True)
@click.option("--conversation-id", default="cli-conversation", show_default=True)
def main(prompt: str, org_id: str, user_id: str, conversation_id: str) -> None:
    """Execute the crew and print the structured response."""

    validate_environment()
    crew = AuthenticatedSupportCrew().crew()
    result = crew.kickoff(
        inputs={
            "user_prompt": prompt,
            "org_id": org_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
        }
    )

    final_output = result.tasks_output[-1] if result.tasks_output else None
    structured = getattr(final_output, "pydantic", None)

    summary = structured.summary if structured else (result.raw or "")
    actions = structured.actions if structured else []

    click.echo()
    click.echo(click.style("Summary:", fg="cyan"))
    click.echo(summary)
    if actions:
        click.echo()
        click.echo(click.style("Actions:", fg="cyan"))
        for action in actions:
            click.echo(f"- {action}")


if __name__ == "__main__":
    main()
