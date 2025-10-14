"""Dependency injection container for eliminating global state"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass
class ServiceDefinition:
    """Definition of a service in the container"""

    service_type: type[Any]
    factory: Callable[[], Any]
    singleton: bool = True
    instance: Any | None = None


class Container:
    """Simple dependency injection container"""

    def __init__(self) -> None:
        self._services: dict[type[Any], ServiceDefinition] = {}

    def register_singleton(
        self, service_type: type[Any], factory: Callable[[], Any]
    ) -> None:
        """Register a singleton service"""
        self._services[service_type] = ServiceDefinition(
            service_type=service_type, factory=factory, singleton=True
        )

    def register_transient(
        self, service_type: type[Any], factory: Callable[[], Any]
    ) -> None:
        """Register a transient service (new instance each time)"""
        self._services[service_type] = ServiceDefinition(
            service_type=service_type, factory=factory, singleton=False
        )

    def get(self, service_type: type[Any]) -> Any:
        """Get a service instance"""
        if service_type not in self._services:
            raise ValueError(f"Service {service_type} not registered")

        definition = self._services[service_type]

        if definition.singleton:
            if definition.instance is None:
                definition.instance = definition.factory()
            return definition.instance
        else:
            return definition.factory()

    def has(self, service_type: type[Any]) -> bool:
        """Check if a service is registered"""
        return service_type in self._services

    def clear(self) -> None:
        """Clear all services (useful for testing)"""
        self._services.clear()


# Global container instance (to be replaced with proper DI)
_container: Container | None = None


def get_container() -> Container:
    """Get the global container instance"""
    global _container
    if _container is None:
        _container = Container()
    return _container


def reset_container() -> None:
    """Reset the global container (useful for testing)"""
    global _container
    _container = None
