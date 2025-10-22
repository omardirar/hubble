"""Custom exceptions for the database access layer."""

from __future__ import annotations

from h10s.exceptions import PersistenceError


class DatabaseUnavailableError(PersistenceError):
    """Raised when the persistence layer cannot be reached."""


__all__ = ["DatabaseUnavailableError"]
