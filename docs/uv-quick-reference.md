# UV Workspace Quick Reference

This is a quick reference for working with the Hubble UV workspace setup.

## Key Points

- **Always run UV commands from repository root** (`/Users/omar/Documents/hubble/`)
- **Single .venv** at repository root serves all projects
- **Python 3.13.7** is used consistently across all projects

## Essential Commands

```bash
# From repository root (/Users/omar/Documents/hubble/)

# Sync all workspace dependencies
uv sync

# Add dependency to specific project
uv add --project services/agents fastapi
uv add --project services/mcp/dice-roll click
uv add --project services/mcp/motherduck duckdb

# Run commands (UV will use the workspace .venv)
uv run pytest services/agents/tests/
uv run python services/mcp/dice-roll/src/server.py

# Update all dependencies
uv sync --upgrade

# Check Python version
uv python list

# Install Python 3.13.7 if needed
uv python install 3.13.7
```

## Directory Structure

```text
hubble/
├── .venv/                    # Single virtual environment (DO NOT DELETE)
├── uv.toml                   # UV workspace configuration
├── pyproject.toml            # Workspace metadata
├── uv.lock                   # Unified lockfile
└── services/
    ├── agents/pyproject.toml
    ├── mcp/dice-roll/pyproject.toml
    └── mcp/motherduck/pyproject.toml
```

## Troubleshooting

| Problem                          | Solution                                           |
| -------------------------------- | -------------------------------------------------- |
| UV creates .venv in subdirectory | Run commands from repo root                        |
| Import errors                    | Run `uv sync` from repo root                       |
| Wrong Python version             | Run `uv python install 3.13.7`                     |
| Dependencies not found           | Use `uv run <command>` instead of direct execution |

## Benefits Recap

- ✅ Single environment = No switching contexts
- ✅ Python 3.13.7 everywhere = Consistency
- ✅ UV performance = 10-100x faster than pip
- ✅ Workspace management = Unified dependencies
