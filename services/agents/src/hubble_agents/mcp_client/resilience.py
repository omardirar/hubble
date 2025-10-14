"""MCP Resilience Module

Combines circuit breaker, rate limiting, and metrics collection for MCP clients.
This module provides fault tolerance, rate limiting, and observability features.
"""

import asyncio
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ..utils.container import get_container
from ..utils.logging import get_logger
from .exceptions import MCPConnectionError, MCPTimeoutError

logger = get_logger(__name__)


# Circuit Breaker Implementation
class CircuitState(Enum):
    """Circuit breaker states"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Circuit is open, requests fail fast
    HALF_OPEN = "half_open"  # Testing if service is back


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker"""

    failure_threshold: int = 5  # Number of failures before opening
    recovery_timeout: float = 30.0  # Seconds to wait before half-open
    success_threshold: int = 3  # Successes needed to close from half-open
    timeout: float = 10.0  # Request timeout in seconds


class CircuitBreaker:
    """Circuit breaker implementation for MCP servers"""

    def __init__(self, name: str, config: CircuitBreakerConfig | None = None) -> None:
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float | None = None
        self._lock = asyncio.Lock()

    async def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Execute function with circuit breaker protection"""
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    logger.info(f"Circuit breaker {self.name} entering HALF_OPEN state")
                else:
                    raise MCPConnectionError(f"Circuit breaker {self.name} is OPEN")

        try:
            result = await asyncio.wait_for(
                func(*args, **kwargs), timeout=self.config.timeout
            )
        except TimeoutError as exc:
            logger.debug(f"Circuit breaker {self.name} caught timeout: {exc}")
            await self._on_failure()
            raise MCPTimeoutError(
                f"Circuit breaker {self.name}: request timed out"
            ) from exc
        except Exception:
            await self._on_failure()
            raise
        else:
            await self._on_success()
            return result

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        return time.time() - self.last_failure_time >= self.config.recovery_timeout

    async def _on_success(self) -> None:
        """Handle successful operation"""
        async with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    logger.info(
                        f"Circuit breaker {self.name} closed after "
                        f"{self.success_count} successes"
                    )
            else:
                self.failure_count = 0

    async def _on_failure(self) -> None:
        """Handle failed operation"""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            self.success_count = 0

            if self.failure_count >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker {self.name} opened after "
                    f"{self.failure_count} failures"
                )

    def get_state(self) -> dict[str, Any]:
        """Get current circuit breaker state"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure_time": self.last_failure_time,
        }


# Rate Limiting Implementation
@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""

    requests_per_minute: int = 60
    burst_size: int = 10
    window_size: float = 60.0  # seconds


class TokenBucket:
    """Token bucket rate limiter implementation"""

    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens: float = float(capacity)
        self.last_refill = time.time()
        self._lock = threading.Lock()

    def try_consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from the bucket"""
        with self._lock:
            now = time.time()
            time_passed = now - self.last_refill

            # Refill tokens based on time passed
            self.tokens = min(
                self.capacity, self.tokens + time_passed * self.refill_rate
            )
            self.last_refill = now

            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def get_tokens_available(self) -> float:
        """Get number of tokens currently available"""
        with self._lock:
            now = time.time()
            time_passed = now - self.last_refill
            return min(self.capacity, self.tokens + time_passed * self.refill_rate)


class RateLimiter:
    """Rate limiter for MCP requests"""

    def __init__(self, config: RateLimitConfig | None = None) -> None:
        self.config = config or RateLimitConfig()
        self.bucket = TokenBucket(
            capacity=self.config.burst_size,
            refill_rate=self.config.requests_per_minute / 60.0,
        )
        self._lock = threading.Lock()

    def is_allowed(self, tokens: int = 1) -> bool:
        """Check if request is allowed under rate limit"""
        return self.bucket.try_consume(tokens)

    def get_status(self) -> dict[str, Any]:
        """Get current rate limiter status"""
        return {
            "tokens_available": self.bucket.get_tokens_available(),
            "capacity": self.bucket.capacity,
            "refill_rate": self.bucket.refill_rate,
        }


# Metrics Collection
@dataclass
class MCPMetrics:
    """Metrics for MCP operations"""

    server_name: str
    request_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    timeout_count: int = 0
    connection_error_count: int = 0
    total_latency_ms: float = 0.0
    min_latency_ms: float = float("inf")
    max_latency_ms: float = 0.0
    last_request_time: float | None = None
    last_success_time: float | None = None
    last_failure_time: float | None = None
    error_types: dict[str, int] = field(default_factory=dict)
    tool_calls: dict[str, int] = field(default_factory=dict)
    latency_samples: deque[float] = field(default_factory=lambda: deque(maxlen=100))


class MCPMetricsCollector:
    """Collects and aggregates MCP metrics"""

    def __init__(self) -> None:
        self._metrics: dict[str, MCPMetrics] = {}
        self._lock = threading.Lock()
        self._start_time = time.time()

    def record_request(self, server_name: str, tool_name: str | None = None) -> None:
        """Record a request to an MCP server"""
        with self._lock:
            if server_name not in self._metrics:
                self._metrics[server_name] = MCPMetrics(server_name=server_name)

            metrics = self._metrics[server_name]
            metrics.request_count += 1
            metrics.last_request_time = time.time()

            if tool_name:
                metrics.tool_calls[tool_name] = metrics.tool_calls.get(tool_name, 0) + 1

    def record_success(self, server_name: str, latency_ms: float) -> None:
        """Record a successful MCP operation"""
        with self._lock:
            if server_name in self._metrics:
                metrics = self._metrics[server_name]
                metrics.success_count += 1
                metrics.last_success_time = time.time()
                metrics.total_latency_ms += latency_ms
                metrics.min_latency_ms = min(metrics.min_latency_ms, latency_ms)
                metrics.max_latency_ms = max(metrics.max_latency_ms, latency_ms)
                metrics.latency_samples.append(latency_ms)

    def record_failure(
        self, server_name: str, error_type: str, latency_ms: float | None = None
    ) -> None:
        """Record a failed MCP operation"""
        with self._lock:
            if server_name in self._metrics:
                metrics = self._metrics[server_name]
                metrics.failure_count += 1
                metrics.last_failure_time = time.time()
                metrics.error_types[error_type] = (
                    metrics.error_types.get(error_type, 0) + 1
                )

                if latency_ms is not None:
                    metrics.total_latency_ms += latency_ms
                    metrics.min_latency_ms = min(metrics.min_latency_ms, latency_ms)
                    metrics.max_latency_ms = max(metrics.max_latency_ms, latency_ms)
                    metrics.latency_samples.append(latency_ms)

    def record_timeout(self, server_name: str) -> None:
        """Record a timeout for an MCP operation"""
        with self._lock:
            if server_name in self._metrics:
                metrics = self._metrics[server_name]
                metrics.timeout_count += 1
                metrics.failure_count += 1
                metrics.last_failure_time = time.time()
                metrics.error_types["timeout"] = (
                    metrics.error_types.get("timeout", 0) + 1
                )

    def record_connection_error(self, server_name: str) -> None:
        """Record a connection error for an MCP operation"""
        with self._lock:
            if server_name in self._metrics:
                metrics = self._metrics[server_name]
                metrics.connection_error_count += 1
                metrics.failure_count += 1
                metrics.last_failure_time = time.time()
                metrics.error_types["connection_error"] = (
                    metrics.error_types.get("connection_error", 0) + 1
                )

    def get_metrics(self, server_name: str | None = None) -> dict[str, Any]:
        """Get metrics for a specific server or all servers"""
        with self._lock:
            if server_name:
                if server_name in self._metrics:
                    metrics = self._metrics[server_name]
                    total_requests = metrics.request_count or 1
                    success_rate = (metrics.success_count / total_requests) * 100
                    failure_rate = (metrics.failure_count / total_requests) * 100
                    avg_latency = metrics.total_latency_ms / total_requests

                    samples = list(metrics.latency_samples)
                    samples.sort()
                    p50 = samples[len(samples) // 2] if samples else 0.0
                    p95 = samples[int(len(samples) * 0.95)] if samples else 0.0
                    p99 = samples[int(len(samples) * 0.99)] if samples else 0.0

                    return {
                        "server_name": metrics.server_name,
                        "total_requests": metrics.request_count,
                        "success_count": metrics.success_count,
                        "failure_count": metrics.failure_count,
                        "timeout_count": metrics.timeout_count,
                        "connection_error_count": metrics.connection_error_count,
                        "success_rate_percent": round(success_rate, 2),
                        "failure_rate_percent": round(failure_rate, 2),
                        "avg_latency_ms": round(avg_latency, 2),
                        "min_latency_ms": round(metrics.min_latency_ms, 2)
                        if metrics.min_latency_ms != float("inf")
                        else 0.0,
                        "max_latency_ms": round(metrics.max_latency_ms, 2),
                        "p50_latency_ms": round(p50, 2),
                        "p95_latency_ms": round(p95, 2),
                        "p99_latency_ms": round(p99, 2),
                        "error_types": dict(metrics.error_types),
                        "tool_calls": dict(metrics.tool_calls),
                        "uptime_seconds": time.time() - self._start_time,
                    }
                return {}
            else:
                return {name: self.get_metrics(name) for name in self._metrics}


# Global instances (to be replaced with dependency injection)
_circuit_breakers: dict[str, CircuitBreaker] = {}
_rate_limiters: dict[str, RateLimiter] = {}


def get_circuit_breaker(
    name: str, config: CircuitBreakerConfig | None = None
) -> CircuitBreaker:
    """Get or create a circuit breaker for a server"""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name, config)
    return _circuit_breakers[name]


def get_rate_limiter(name: str, config: RateLimitConfig | None = None) -> RateLimiter:
    """Get or create a rate limiter for a server"""
    if name not in _rate_limiters:
        _rate_limiters[name] = RateLimiter(config)
    return _rate_limiters[name]


def get_metrics_collector() -> MCPMetricsCollector:
    """Get metrics collector from dependency injection container"""
    container = get_container()
    if not container.has(MCPMetricsCollector):
        container.register_singleton(MCPMetricsCollector, MCPMetricsCollector)
    collector = container.get(MCPMetricsCollector)
    assert isinstance(collector, MCPMetricsCollector)
    return collector


# Convenience functions via DI metrics collector
def record_request(server_name: str, tool_name: str | None = None) -> None:
    """Record a request to an MCP server"""
    get_metrics_collector().record_request(server_name, tool_name)


def record_success(server_name: str, latency_ms: float) -> None:
    """Record a successful MCP operation"""
    get_metrics_collector().record_success(server_name, latency_ms)


def record_failure(
    server_name: str, error_type: str, latency_ms: float | None = None
) -> None:
    """Record a failed MCP operation"""
    get_metrics_collector().record_failure(server_name, error_type, latency_ms)


def record_timeout(server_name: str) -> None:
    """Record a timeout for an MCP operation"""
    get_metrics_collector().record_timeout(server_name)


def record_connection_error(server_name: str) -> None:
    """Record a connection error for an MCP operation"""
    get_metrics_collector().record_connection_error(server_name)
