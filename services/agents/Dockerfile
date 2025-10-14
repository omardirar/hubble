FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Copy source code
COPY pyproject.toml ./
COPY src/ ./src/

# Use uv to install without venv
ENV UV_SYSTEM_PYTHON=1
RUN uv pip install --no-cache -e . && \
    useradd --create-home --shell /bin/bash app
USER app

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
