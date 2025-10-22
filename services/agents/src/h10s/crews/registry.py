"""Registry mapping crew identifiers to implementations."""

from __future__ import annotations

import logging

from h10s.crews.base import BaseCrew
from h10s.crews.copilot.crew import CopilotCrew

logger = logging.getLogger(__name__)

CREW_REGISTRY: dict[str, type[BaseCrew]] = {
    "copilot": CopilotCrew,
}


def get_crew_class(name: str) -> type[BaseCrew]:
    """Return the crew class registered under the given name."""

    if name not in CREW_REGISTRY:
        logger.error("Crew requested but not registered name=%s", name)
        raise ValueError(f"Unknown crew: {name}")
    logger.debug("Crew class resolved name=%s class=%s", name, CREW_REGISTRY[name].__name__)
    return CREW_REGISTRY[name]


__all__ = ["CREW_REGISTRY", "get_crew_class"]
