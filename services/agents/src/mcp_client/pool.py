"""Connection pool for MCP SDK clients with resilience patterns"""

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from ..utils.logging import get_logger
from .client import MCPClient
from .exceptions import MCPConnectionError

logger = get_logger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreaker:
    """Circuit breaker for MCP connections"""

    failure_threshold: int = 5
    timeout_seconds: int = 60
    half_open_max_attempts: int = 3

    state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    failure_count: int = field(default=0, init=False)
    last_failure_time: datetime | None = field(default=None, init=False)
    half_open_attempts: int = field(default=0, init=False)

    def record_success(self) -> None:
        """Record a successful operation"""
        self.failure_count = 0
        self.half_open_attempts = 0
        if self.state != CircuitState.CLOSED:
            logger.info("Circuit breaker recovered, closing circuit")
            self.state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Record a failed operation"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.state == CircuitState.HALF_OPEN:
            logger.warning("Circuit breaker half-open test failed, reopening circuit")
            self.state = CircuitState.OPEN
            self.half_open_attempts = 0
        elif self.failure_count >= self.failure_threshold:
            logger.error(f"Circuit breaker opened after {self.failure_count} failures")
            self.state = CircuitState.OPEN

    def can_attempt(self) -> bool:
        """Check if we can attempt a request"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if timeout has passed
            if self.last_failure_time:
                time_since_failure = datetime.now() - self.last_failure_time
                if time_since_failure.total_seconds() >= self.timeout_seconds:
                    logger.info(
                        "Circuit breaker timeout passed, entering half-open state"
                    )
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_attempts = 0
                    return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_attempts < self.half_open_max_attempts:
                self.half_open_attempts += 1
                return True
            return False

        return False


@dataclass
class RateLimiter:
    """Token bucket rate limiter"""

    max_tokens: int = 100
    refill_rate: float = 10.0  # tokens per second

    tokens: float = field(init=False)
    last_refill: datetime = field(default_factory=datetime.now, init=False)

    def __post_init__(self) -> None:
        self.tokens = float(self.max_tokens)

    def _refill(self) -> None:
        """Refill tokens based on time elapsed"""
        now = datetime.now()
        elapsed = (now - self.last_refill).total_seconds()
        self.tokens = min(self.max_tokens, self.tokens + (elapsed * self.refill_rate))
        self.last_refill = now

    def acquire(self, tokens: int = 1) -> bool:
        """Try to acquire tokens"""
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    async def wait_for_token(self, tokens: int = 1, timeout: float = 30.0) -> bool:
        """Wait until tokens are available"""
        start = time.time()
        while time.time() - start < timeout:
            if self.acquire(tokens):
                return True
            await asyncio.sleep(0.1)
        return False


@dataclass
class PooledConnection:
    """A pooled MCP SDK client"""

    client: MCPClient
    created_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    use_count: int = 0
    is_healthy: bool = True


class MCPConnectionPool:
    """Connection pool for MCP SDK clients with resilience patterns"""

    def __init__(
        self,
        max_connections: int = 10,
        max_idle_time: int = 300,
        health_check_interval: int = 60,
        enable_circuit_breaker: bool = True,
        enable_rate_limiting: bool = True,
    ):
        self.max_connections = max_connections
        self.max_idle_time = max_idle_time
        self.health_check_interval = health_check_interval
        self.enable_circuit_breaker = enable_circuit_breaker
        self.enable_rate_limiting = enable_rate_limiting

        # Connection pools per server
        self._pools: dict[str, list[PooledConnection]] = defaultdict(list)
        self._pool_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

        # Resilience patterns
        self._circuit_breakers: dict[str, CircuitBreaker] = {}
        self._rate_limiters: dict[str, RateLimiter] = {}

        # Background tasks
        self._cleanup_task: asyncio.Task[Any] | None = None
        self._health_check_task: asyncio.Task[Any] | None = None

    def _get_circuit_breaker(self, server_url: str) -> CircuitBreaker:
        """Get or create circuit breaker for server"""
        if server_url not in self._circuit_breakers:
            self._circuit_breakers[server_url] = CircuitBreaker()
        return self._circuit_breakers[server_url]

    def _get_rate_limiter(self, server_url: str) -> RateLimiter:
        """Get or create rate limiter for server"""
        if server_url not in self._rate_limiters:
            self._rate_limiters[server_url] = RateLimiter()
        return self._rate_limiters[server_url]

    async def get_client(
        self,
        url: str,
        token: str | None = None,
        database: str | None = None,
        **kwargs: Any,
    ) -> MCPClient:
        """Get a client from the pool or create a new one"""

        # Get circuit breaker and rate limiter
        breaker = (
            self._get_circuit_breaker(url) if self.enable_circuit_breaker else None
        )
        limiter = self._get_rate_limiter(url) if self.enable_rate_limiting else None

        # Check circuit breaker
        if breaker and not breaker.can_attempt():
            raise MCPConnectionError(f"Circuit breaker open for {url}")

        # Check rate limit
        if limiter and not await limiter.wait_for_token():
            raise MCPConnectionError(f"Rate limit exceeded for {url}")

        async with self._pool_locks[url]:
            # Try to get an existing connection
            pool = self._pools[url]
            now = datetime.now()

            for conn in pool:
                if conn.is_healthy and conn.client._initialized:
                    conn.last_used = now
                    conn.use_count += 1

                    if breaker:
                        breaker.record_success()

                    return conn.client

            # Create new connection if under limit
            if len(pool) < self.max_connections:
                client = MCPClient(url=url, token=token, database=database, **kwargs)
                try:
                    await client.initialize()
                except Exception as e:
                    if breaker:
                        breaker.record_failure()
                    await client.close()
                    logger.error(f"Failed to create connection for {url}: {e}")
                    raise MCPConnectionError(f"Failed to create connection: {e}") from e

                pooled_conn = PooledConnection(client=client)
                pooled_conn.use_count = 1
                pool.append(pooled_conn)

                if breaker:
                    breaker.record_success()

                logger.info(f"Created new pooled connection for {url}")
                return client

            # Pool is full, wait and retry
            raise MCPConnectionError(f"Connection pool full for {url}")

    async def release_client(self, client: MCPClient) -> None:
        """Release a client back to the pool"""
        # Client stays in pool, just update last_used time
        url = client.url
        async with self._pool_locks[url]:
            pool = self._pools[url]
            for conn in pool:
                if conn.client is client:
                    conn.last_used = datetime.now()
                    break

    async def _cleanup_idle_connections(self) -> None:
        """Periodically clean up idle connections"""
        while True:
            try:
                await asyncio.sleep(60)  # Run every minute
                now = datetime.now()

                for url, pool in list(self._pools.items()):
                    async with self._pool_locks[url]:
                        to_remove = []
                        for conn in pool:
                            idle_time = (now - conn.last_used).total_seconds()
                            if idle_time > self.max_idle_time:
                                to_remove.append(conn)

                        for conn in to_remove:
                            await conn.client.close()
                            pool.remove(conn)
                            logger.info(f"Removed idle connection for {url}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def _health_check_connections(self) -> None:
        """Periodically health check connections"""
        while True:
            try:
                await asyncio.sleep(self.health_check_interval)

                for url, pool in list(self._pools.items()):
                    async with self._pool_locks[url]:
                        for conn in pool:
                            try:
                                is_healthy = await conn.client.health_check()
                                conn.is_healthy = is_healthy
                                if not is_healthy:
                                    logger.warning(f"Connection unhealthy for {url}")
                            except Exception as e:
                                logger.error(f"Health check failed for {url}: {e}")
                                conn.is_healthy = False

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check task: {e}")

    async def start_background_tasks(self) -> None:
        """Start background maintenance tasks"""
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_idle_connections())
        if not self._health_check_task:
            self._health_check_task = asyncio.create_task(
                self._health_check_connections()
            )

    async def close_all(self) -> None:
        """Close all connections and stop background tasks"""
        import contextlib

        # Cancel background tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._cleanup_task
            self._cleanup_task = None
        if self._health_check_task:
            self._health_check_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._health_check_task
            self._health_check_task = None

        # Close all connections
        for url, pool in self._pools.items():
            for conn in pool:
                try:
                    await conn.client.close()
                except Exception as e:
                    logger.error(f"Error closing connection for {url}: {e}")

        self._pools.clear()
        logger.info("All connections closed")


# Global pool instance
_global_pool: MCPConnectionPool | None = None


def get_connection_pool() -> MCPConnectionPool:
    """Get the global connection pool"""
    global _global_pool
    if _global_pool is None:
        _global_pool = MCPConnectionPool()
    return _global_pool


async def get_pooled_client(
    url: str,
    token: str | None = None,
    database: str | None = None,
    **kwargs: Any,
) -> MCPClient:
    """Get a client from the global pool"""
    pool = get_connection_pool()
    return await pool.get_client(url=url, token=token, database=database, **kwargs)
