"""Reusable Pydantic field validators and annotated types."""

from __future__ import annotations

from typing import Annotated

from pydantic import StringConstraints

StrippedNonEmpty = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]

__all__ = ["StrippedNonEmpty"]
