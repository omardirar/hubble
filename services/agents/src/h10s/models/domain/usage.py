"""Usage reporting models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import ConfigDict, Field

from h10s.models.base import H10SBaseModel


class UsageRecord(H10SBaseModel):
    """Representation of usage metrics persisted in storage."""

    run_id: uuid.UUID
    conversation_id: uuid.UUID
    org_id: uuid.UUID
    llm_provider: str
    llm_model: str
    tokens: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UsageSummary(H10SBaseModel):
    """Aggregated usage metrics surfaced via the API."""

    total_tokens: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)


__all__ = ["UsageRecord", "UsageSummary"]
