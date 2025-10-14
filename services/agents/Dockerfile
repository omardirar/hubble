# Base with uv on Debian
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# Copy minimal metadata first (better layer caching)
COPY pyproject.toml ./pyproject.toml

# Copy source
COPY src/ ./src/

# Install the package (src-layout)
RUN uv pip install --no-cache -e . && \
    useradd --create-home --shell /bin/bash app

USER app

EXPOSE 8000

# Optional healthcheck hitting FastAPI /health
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status==200 else sys.exit(1)"

# Run via module import path (package name, not filesystem path)
CMD ["uvicorn", "hubble_agents.main:app", "--host", "0.0.0.0", "--port", "8000"]
