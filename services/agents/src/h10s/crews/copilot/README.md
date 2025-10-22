# Growth Copilot Crew

This package scaffolds a hierarchical CrewAI workflow composed of a manager agent and
a marketing specialist. The crew is designed to accept a user prompt describing a
marketing goal or budget and produce a structured recommendation.

The implementation is intentionally lightweight and focuses on laying out extension
points:

- `copilot.py` constructs the crew and exposes helpers to launch it.
- `config/agents.yml` and `config/tasks.yml` define agent personalities and task templates.
- Future tooling integrations (Supabase MCP, web research, etc.) should be registered via
  the TODO markers within `copilot.py`.

Refer to the inline TODO comments when implementing the remaining behaviour.
