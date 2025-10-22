"""Crew run domain models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import ConfigDict, Field

from h10s.models.base import H10SBaseModel
from h10s.models.enums import RunStatus


class Run(H10SBaseModel):
    """Representation of a crew execution run."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    crew_name: str
    crew_version: str
    status: RunStatus
    content: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RunCreate(H10SBaseModel):
    """Payload for creating runs."""

    run_id: uuid.UUID
    conversation_id: uuid.UUID
    crew_name: str
    crew_version: str
    status: RunStatus
    content: dict[str, Any] = Field(default_factory=dict)


class RunUpdate(H10SBaseModel):
    """Payload for updating runs."""

    status: RunStatus
    content: dict[str, Any] | None = None
    usage: dict[str, Any] | None = None
    conversation_id: uuid.UUID | None = None


__all__ = ["Run", "RunCreate", "RunUpdate"]
