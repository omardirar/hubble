"""Health check system for MCP servers"""

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ..utils.logging import get_logger
from .client import MCPClient
from .resilience import get_metrics_collector

logger = get_logger(__name__)


@dataclass
class HealthCheckResult:
    """Result of a health check"""

    server_name: str
    is_healthy: bool
    last_check: float
    response_time_ms: float
    error_message: str | None = None
    consecutive_failures: int = 0
    last_success: float | None = None


class MCPHealthChecker:
    """Health checker for MCP servers"""

    def __init__(self, check_interval: int = 30):
        self.check_interval = check_interval
        self.health_results: dict[str, HealthCheckResult] = {}
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._servers: dict[str, dict[str, Any]] = {}
        self._callbacks: list[Callable[[str, bool], None]] = []
        self._metrics = get_metrics_collector()

    def add_server(
        self, name: str, url: str, token: str | None = None, database: str | None = None
    ) -> None:
        """Add a server to health checking"""
        self._servers[name] = {"url": url, "token": token, "database": database}
        logger.info(f"Added server {name} to health checking: {url}")

    def remove_server(self, name: str) -> None:
        """Remove a server from health checking"""
        if name in self._servers:
            del self._servers[name]
        if name in self.health_results:
            del self.health_results[name]
        logger.info(f"Removed server {name} from health checking")

    def add_health_callback(self, callback: Callable[[str, bool], None]) -> None:
        """Add a callback for health status changes"""
        self._callbacks.append(callback)

    async def start(self) -> None:
        """Start the health checker"""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._health_check_loop())
        logger.info(f"Started MCP health checker (interval: {self.check_interval}s)")

    async def stop(self) -> None:
        """Stop the health checker"""
        if not self._running:
            return

        import contextlib

        self._running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        logger.info("Stopped MCP health checker")

    async def _health_check_loop(self) -> None:
        """Main health check loop"""
        while self._running:
            try:
                await self._check_all_servers()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(5)  # Short delay before retry

    async def _check_all_servers(self) -> None:
        """Check health of all servers"""
        tasks = []
        for name, config in self._servers.items():
            task = asyncio.create_task(self._check_server(name, config))
            tasks.append(task)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _check_server(self, name: str, config: dict[str, Any]) -> None:
        """Check health of a single server"""
        start_time = time.time()
        is_healthy = False
        error_message = None

        try:
            # Create a temporary client for health check
            client = MCPClient(
                url=config["url"],
                token=config.get("token"),
                database=config.get("database"),
                timeout=10,  # Short timeout for health checks
                connection_timeout=5,
                read_timeout=10,
            )

            # Try to perform a health check
            is_healthy = await client.health_check()

            if is_healthy:
                # Record success metrics
                response_time = (time.time() - start_time) * 1000
                self._metrics.record_success(name, response_time)
            else:
                error_message = "Health check failed"

        except Exception as e:
            error_message = str(e)
            self._metrics.record_failure(name, type(e).__name__)
            logger.warning(f"Health check failed for {name}: {e}")

        response_time = (time.time() - start_time) * 1000

        # Update health result
        previous_result = self.health_results.get(name)
        was_healthy = previous_result.is_healthy if previous_result else None

        if is_healthy:
            consecutive_failures = 0
            last_success: float | None = time.time()
        else:
            consecutive_failures = (
                (previous_result.consecutive_failures + 1) if previous_result else 1
            )
            last_success = previous_result.last_success if previous_result else None

        self.health_results[name] = HealthCheckResult(
            server_name=name,
            is_healthy=is_healthy,
            last_check=time.time(),
            response_time_ms=response_time,
            error_message=error_message,
            consecutive_failures=consecutive_failures,
            last_success=last_success,
        )

        # Notify callbacks if health status changed
        if was_healthy is not None and was_healthy != is_healthy:
            for callback in self._callbacks:
                try:
                    callback(name, is_healthy)
                except Exception as e:
                    logger.error(f"Error in health callback: {e}")

    async def check_server_now(self, name: str) -> HealthCheckResult | None:
        """Check a specific server immediately"""
        if name not in self._servers:
            raise ValueError(f"Server {name} not found")

        config = self._servers[name]
        await self._check_server(name, config)
        return self.health_results.get(name)

    def get_health_status(self, name: str | None = None) -> dict[str, Any]:
        """Get health status for a server or all servers"""
        if name:
            result = self.health_results.get(name)
            if not result:
                return {"error": f"Server {name} not found"}
            return self._format_health_result(result)
        else:
            return {
                name: self._format_health_result(result)
                for name, result in self.health_results.items()
            }

    def _format_health_result(self, result: HealthCheckResult) -> dict[str, Any]:
        """Format health result for output"""
        return {
            "server_name": result.server_name,
            "is_healthy": result.is_healthy,
            "last_check": result.last_check,
            "response_time_ms": round(result.response_time_ms, 2),
            "error_message": result.error_message,
            "consecutive_failures": result.consecutive_failures,
            "last_success": result.last_success,
            "uptime_seconds": time.time() - result.last_check
            if result.is_healthy
            else 0,
        }

    def get_unhealthy_servers(self) -> list[str]:
        """Get list of unhealthy servers"""
        return [
            name
            for name, result in self.health_results.items()
            if not result.is_healthy
        ]

    def is_server_healthy(self, name: str) -> bool:
        """Check if a specific server is healthy"""
        result = self.health_results.get(name)
        return result.is_healthy if result else False


# Global health checker
_health_checker = MCPHealthChecker()


def get_health_checker() -> MCPHealthChecker:
    """Get the global health checker"""
    return _health_checker


async def start_health_checking(
    servers: dict[str, dict[str, Any]], interval: int = 30
) -> None:
    """Start health checking for servers"""
    checker = get_health_checker()
    checker.check_interval = interval

    for name, config in servers.items():
        checker.add_server(name, **config)

    await checker.start()


async def stop_health_checking() -> None:
    """Stop health checking"""
    checker = get_health_checker()
    await checker.stop()


def get_health_status(name: str | None = None) -> dict[str, Any]:
    """Get health status (convenience function)"""
    checker = get_health_checker()
    return checker.get_health_status(name)
