"""Domain models for internal use."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AuthContext:
    """Authentication context extracted from JWT."""

    user_id: str
    org_id: str
