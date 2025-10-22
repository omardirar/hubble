"""API response payload models."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from h10s.models.base import H10SBaseModel
from h10s.models.enums import RunStatus


class StreamAckResponse(H10SBaseModel):
    """Acknowledgement payload returned when a stream is accepted."""

    run_id: str
    status: RunStatus = Field(default=RunStatus.RUNNING)
    metadata: dict[str, Any] = Field(default_factory=dict)


__all__ = ["StreamAckResponse"]
