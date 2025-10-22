"""Base Pydantic model configuration for the H10S domain."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class H10SBaseModel(BaseModel):
    """Base model featuring shared configuration for all H10S models."""

    model_config = ConfigDict(
        frozen=False,
        validate_assignment=True,
        use_enum_values=True,
        str_strip_whitespace=True,
    )


__all__ = ["H10SBaseModel"]
