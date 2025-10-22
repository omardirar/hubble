"""Custom exception hierarchy for H10S."""

from __future__ import annotations


class H10SError(Exception):
    """Base exception for all H10S errors.

    All custom exceptions in the H10S service should inherit from this class
    to allow for consistent error handling and logging.
    """

    pass


class PersistenceError(H10SError):
    """Database or storage operation failed.

    Raised when operations on Supabase (conversations, messages, runs, usage)
    encounter errors that cannot be recovered from.
    """

    pass


class CrewExecutionError(H10SError):
    """Crew execution failed.

    Raised when CrewAI crew execution encounters an unrecoverable error
    during agent task processing.
    """

    pass


class ConfigurationError(H10SError):
    """Invalid configuration detected.

    Raised when application settings or environment variables are invalid
    or missing required values.
    """

    pass


class AuthenticationError(H10SError):
    """Authentication failed.

    Raised when JWT token validation fails or authentication credentials
    are invalid or missing.
    """

    pass


class AuthorizationError(H10SError):
    """Authorization failed.

    Raised when an authenticated user attempts an action they don't have
    permission to perform (e.g., accessing another organization's data).
    """

    pass


class ValidationError(H10SError):
    """Request validation failed.

    Raised when request payloads fail validation checks (e.g., invalid UUIDs,
    oversized JSON payloads, missing required fields).
    """

    pass


__all__ = [
    "AuthenticationError",
    "AuthorizationError",
    "ConfigurationError",
    "CrewExecutionError",
    "H10SError",
    "PersistenceError",
    "ValidationError",
]
