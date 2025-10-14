"""Configuration validation for MCP servers and tools"""

import os
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator

from ..utils.logging import get_logger

logger = get_logger(__name__)


class MCPServerConfig(BaseModel):
    """Configuration for a single MCP server"""

    name: str
    url: HttpUrl
    token: str | None = None
    database: str | None = None
    timeout: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=10)
    connection_timeout: int = Field(default=60, ge=1, le=120)  # Increased from 10 to 60
    read_timeout: int = Field(default=30, ge=1, le=300)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Any) -> str:
        if not v or not v.strip():
            raise ValueError("Server name cannot be empty")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError(
                "Server name must contain only alphanumeric characters, "
                "hyphens, and underscores"
            )
        return str(v).strip()

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: Any) -> str | None:
        if v is not None and len(str(v).strip()) == 0:
            return None
        return str(v) if v is not None else None

    @field_validator("database")
    @classmethod
    def validate_database(cls, v: Any) -> str | None:
        if v is not None and len(str(v).strip()) == 0:
            return None
        return str(v) if v is not None else None


class MCPClientConfig(BaseModel):
    """Global MCP client configuration"""

    servers: list[MCPServerConfig] = Field(default_factory=list)
    default_timeout: int = Field(default=30, ge=1, le=300)
    default_max_retries: int = Field(default=3, ge=0, le=10)
    enable_circuit_breaker: bool = True
    circuit_breaker_failure_threshold: int = Field(default=5, ge=1, le=20)
    circuit_breaker_recovery_timeout: float = Field(default=30.0, ge=5.0, le=300.0)
    health_check_interval: int = Field(default=30, ge=5, le=300)
    max_concurrent_connections: int = Field(default=3, ge=1, le=10)
    enable_metrics: bool = True
    enable_rate_limiting: bool = True
    rate_limit_requests_per_minute: int = Field(default=60, ge=1, le=1000)


def load_mcp_config() -> MCPClientConfig:
    """Load MCP configuration from environment variables"""
    servers = []

    logger.debug("Loading MCP configuration from environment variables...")
    logger.debug(f"MCP_MOTHERDUCK_URL: {os.getenv('MCP_MOTHERDUCK_URL')}")

    # Load MotherDuck server
    motherduck_url = os.getenv("MCP_MOTHERDUCK_URL")
    if motherduck_url:
        try:
            server = MCPServerConfig(
                name="motherduck",
                url=HttpUrl(motherduck_url),
                token=os.getenv("MOTHERDUCK_TOKEN"),
                database=os.getenv("DATABASE_NAME", "hubble_dev"),
                timeout=int(os.getenv("MCP_MOTHERDUCK_TIMEOUT", "30")),
                max_retries=int(os.getenv("MCP_MOTHERDUCK_MAX_RETRIES", "3")),
            )
            servers.append(server)
            logger.debug(f"Loaded MotherDuck MCP server config: {server.url}")
        except Exception as e:
            logger.error(f"Invalid MotherDuck MCP configuration: {e}")

    # Load Analytics server (optional)
    analytics_url = os.getenv("MCP_ANALYTICS_URL")
    if analytics_url:
        try:
            server = MCPServerConfig(
                name="analytics",
                url=HttpUrl(analytics_url),
                token=os.getenv("ANALYTICS_TOKEN"),
                timeout=int(os.getenv("MCP_ANALYTICS_TIMEOUT", "30")),
                max_retries=int(os.getenv("MCP_ANALYTICS_MAX_RETRIES", "3")),
            )
            servers.append(server)
            logger.debug(f"Loaded Analytics MCP server config: {server.url}")
        except Exception as e:
            logger.error(f"Invalid Analytics MCP configuration: {e}")

    # Load Content server (optional)
    content_url = os.getenv("MCP_CONTENT_URL")
    if content_url:
        try:
            server = MCPServerConfig(
                name="content",
                url=HttpUrl(content_url),
                token=os.getenv("CONTENT_TOKEN"),
                timeout=int(os.getenv("MCP_CONTENT_TIMEOUT", "30")),
                max_retries=int(os.getenv("MCP_CONTENT_MAX_RETRIES", "3")),
            )
            servers.append(server)
            logger.debug(f"Loaded Content MCP server config: {server.url}")
        except Exception as e:
            logger.error(f"Invalid Content MCP configuration: {e}")

    # Create global config
    config = MCPClientConfig(
        servers=servers,
        default_timeout=int(os.getenv("MCP_DEFAULT_TIMEOUT", "30")),
        default_max_retries=int(os.getenv("MCP_DEFAULT_MAX_RETRIES", "3")),
        enable_circuit_breaker=os.getenv("MCP_ENABLE_CIRCUIT_BREAKER", "true").lower()
        == "true",
        circuit_breaker_failure_threshold=int(
            os.getenv("MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "5")
        ),
        circuit_breaker_recovery_timeout=float(
            os.getenv("MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "30.0")
        ),
        health_check_interval=int(os.getenv("MCP_HEALTH_CHECK_INTERVAL", "30")),
        max_concurrent_connections=int(
            os.getenv("MCP_MAX_CONCURRENT_CONNECTIONS", "3")
        ),
        enable_metrics=os.getenv("MCP_ENABLE_METRICS", "true").lower() == "true",
        enable_rate_limiting=os.getenv("MCP_ENABLE_RATE_LIMITING", "true").lower()
        == "true",
        rate_limit_requests_per_minute=int(os.getenv("MCP_RATE_LIMIT_RPM", "60")),
    )

    logger.debug(f"Loaded MCP configuration with {len(servers)} servers")
    return config


def validate_server_config(config: MCPServerConfig) -> list[str]:
    """Validate server configuration and return any issues"""
    issues = []

    # Check URL accessibility (basic validation)
    if not str(config.url).startswith(("http://", "https://")):
        issues.append(f"Server {config.name}: URL must start with http:// or https://")

    # Check token format if present
    if config.token and len(config.token) < 10:
        issues.append(
            f"Server {config.name}: Token appears too short (minimum 10 characters)"
        )

    # Check database name format if present
    if (
        config.database
        and not config.database.replace("_", "").replace("-", "").isalnum()
    ):
        issues.append(
            f"Server {config.name}: Database name contains invalid characters"
        )

    # Check timeout values
    if config.timeout < 5:
        issues.append(f"Server {config.name}: Timeout too low (minimum 5 seconds)")

    if config.max_retries > 10:
        issues.append(f"Server {config.name}: Max retries too high (maximum 10)")

    return issues


def validate_global_config(config: MCPClientConfig) -> list[str]:
    """Validate global configuration and return any issues"""
    issues = []

    # Check server count
    if len(config.servers) == 0:
        issues.append("No MCP servers configured")

    # Check for duplicate server names
    names = [server.name for server in config.servers]
    if len(names) != len(set(names)):
        issues.append("Duplicate server names found")

    # Check concurrent connections
    if config.max_concurrent_connections > len(config.servers) * 2:
        issues.append(
            "Max concurrent connections may be too high for configured servers"
        )

    # Validate individual servers
    for server in config.servers:
        server_issues = validate_server_config(server)
        issues.extend(server_issues)

    return issues


def get_config_summary(config: MCPClientConfig) -> dict[str, Any]:
    """Get configuration summary for logging"""
    return {
        "servers_count": len(config.servers),
        "server_names": [s.name for s in config.servers],
        "default_timeout": config.default_timeout,
        "default_max_retries": config.default_max_retries,
        "circuit_breaker_enabled": config.enable_circuit_breaker,
        "health_check_interval": config.health_check_interval,
        "max_concurrent_connections": config.max_concurrent_connections,
        "metrics_enabled": config.enable_metrics,
        "rate_limiting_enabled": config.enable_rate_limiting,
    }
