# UV Workspace Setup for Hubble

This document explains how the Hubble repository is configured to use UV with a single virtual environment at the repository root, ensuring consistent Python development across all projects.

## Overview

The Hubble repository uses **UV (Ultraviolet)** as the Python package manager with a **workspace configuration** that ensures:

- ✅ **Single `.venv`** at the repository root (`/Users/omar/Documents/hubble/.venv`)
- ✅ **Python 3.13.7** consistently across all projects
- ✅ **Unified dependency management** across the workspace
- ✅ **Faster installation and builds** with UV's Rust-based performance
- ✅ **Simplified development workflow** - no switching between environments

## Architecture

### Workspace Structure

```text
hubble/
├── .venv/                     # Single virtual environment for all projects
├── pyproject.toml             # Root workspace metadata, UV config, and tool configs
├── uv.lock                    # Unified lockfile for all dependencies
├── services/
│   ├── agents/
│   │   └── pyproject.toml     # Project-specific dependencies
│   └── mcp/
│       ├── dice-roll/
│       │   └── pyproject.toml # Project-specific dependencies
│       └── motherduck/
│           └── pyproject.toml # Project-specific dependencies
└── docs/
```

### Configuration Files

#### 1. Root `pyproject.toml`

- Defines the workspace and its members
- Sets Python 3.13.7 requirement
- Configures UV workspace behavior
- Configures shared tooling (ruff, mypy, pytest, coverage)

#### 2. Root `uv.lock`

- Single lockfile containing resolved dependencies for ALL workspace members
- Should be committed to version control for reproducible builds
- Generated automatically by UV

#### 3. Project `pyproject.toml` files

- Define project-specific dependencies
- Inherit Python version from workspace
- Use workspace-managed dependencies where applicable

## Benefits of Single `.venv` Setup

### 1. **Consistency**

- All projects use the exact same Python version (3.13.7)
- Shared dependencies have consistent versions across projects
- No version conflicts between different environments

### 2. **Performance**

- Faster installs (shared dependency cache)
- Reduced disk usage (single copy of packages)
- Faster development environment setup

### 3. **Simplified Workflow**

- No need to activate/deactivate different environments
- Single command to install all workspace dependencies
- Unified testing and linting across projects

### 4. **Better Dependency Management**

- UV resolves dependencies across the entire workspace
- Prevents version conflicts between related projects
- Centralizes security updates and version bumps

## Development Workflow

### Initial Setup

1. **Install UV** (if not already installed):

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install Python 3.13.7**:

   ```bash
   cd /Users/omar/Documents/hubble
   uv python install 3.13.7
   ```

3. **Create and sync the workspace environment**:

   ```bash
   uv sync
   ```

   This will:
   - Create `.venv/` at the repository root

- Install Python 3.13.7 in the virtual environment
- Install all dependencies from all workspace members
- Generate a unified `uv.lock` file

### Daily Development

#### Running Commands

All UV commands should be run from the **repository root**:

```bash
# Install new dependency for a specific project
uv add --project services/agents fastapi

# Run a script from any project
uv run services/agents/src/main.py
uv run services/mcp/dice-roll/src/server.py

# Run tests for specific project
uv run pytest services/agents/tests/
uv run pytest services/mcp/motherduck/tests/

# Run tests for all projects
uv run pytest

# Update dependencies
uv sync --upgrade

# Add development dependencies
uv add --group dev pytest-mock
```

#### Working with Individual Projects

Even though we use a single `.venv`, you can still work on individual projects:

```bash
# Navigate to a project directory
cd services/agents

# Run project-specific commands (UV will use root .venv)
uv run python -m hubble_agents.main
uv run pytest tests/
uv run mypy src/
```

### Key Commands

| Command                             | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `uv sync`                           | Install/update all workspace dependencies |
| `uv add <package>`                  | Add dependency to root workspace          |
| `uv add --project <path> <package>` | Add dependency to specific project        |
| `uv run <command>`                  | Run command in workspace environment      |
| `uv python list`                    | List available Python versions            |
| `uv lock`                           | Update the lockfile                       |

## Environment Variables

UV automatically handles the virtual environment, but you can also use these:

```bash
# UV will automatically use the root .venv
export VIRTUAL_ENV="/Users/omar/Documents/hubble/.venv"
export PATH="$VIRTUAL_ENV/bin:$PATH"
```

## Troubleshooting

### Problem: UV creates .venv in subdirectory instead of root

**Solution**: Always run UV commands from the repository root (`/Users/omar/Documents/hubble/`).

### Problem: Dependencies not found when running from subdirectory

**Solution**: Use `uv run` instead of direct python commands:

```bash
# ❌ Wrong (may use wrong environment)
cd services/agents
python -m pytest

# ✅ Correct (uses workspace environment)
cd services/agents
uv run python -m pytest

# ✅ Also correct (from root)
uv run pytest services/agents/tests/
```

### Problem: Python version mismatch

**Solution**: Ensure Python 3.13.7 is installed and workspace is synced:

```bash
uv python install 3.13.7
uv sync
```

### Problem: Import errors between workspace projects

**Solution**: Install workspace packages in editable mode:

```bash
uv sync --all-packages
```

## Migration from Multiple .venv Setup

If you previously had individual `.venv` directories in each project:

1. **Remove old environments**:

   ```bash
   find . -name ".venv" -not -path "./.venv" -exec rm -rf {} +
   ```

2. **Clean up old lockfiles**:

   ```bash
   find . -name "uv.lock" -not -path "./uv.lock" -delete
   find . -name "*.lock" -delete
   ```

3. **Re-sync workspace**:

   ```bash
   uv sync
   ```

## IDE Configuration

### VS Code

VS Code should automatically detect the workspace `.venv`. If not:

1. Open Command Palette (`Cmd+Shift+P`)
2. Select "Python: Select Interpreter"
3. Choose `/Users/omar/Documents/hubble/.venv/bin/python`

### PyCharm

1. Go to Settings → Project → Python Interpreter
2. Select "Existing environment"
3. Point to `/Users/omar/Documents/hubble/.venv/bin/python`

## Best Practices

1. **Always run UV commands from the repository root**
2. **Use `uv run` for executing Python scripts and commands**
3. **Add dependencies to the appropriate project's `pyproject.toml`**
4. **Regularly run `uv sync` to stay up-to-date**
5. **Use `uv lock` before committing dependency changes**
6. **Test across all workspace projects before releases**

## Security and Updates

### Updating Dependencies

```bash
# Update all dependencies to latest compatible versions
uv sync --upgrade

# Update specific dependency across workspace
uv add "fastapi>=0.105.0"

# Check for security vulnerabilities (requires safety)
uv run safety check
```

### Dependency Auditing

```bash
# Show dependency tree
uv tree

# Check for outdated packages
uv run pip list --outdated
```

## Performance Benefits

UV provides significant performance improvements over traditional tools:

- **10-100x faster** than pip for installations
- **Rust-based resolver** for complex dependency graphs
- **Parallel downloads** and installations
- **Global package cache** reduces redundant downloads
- **Lock file generation** in milliseconds vs. minutes

With the single `.venv` setup, these benefits are amplified across the entire workspace.
