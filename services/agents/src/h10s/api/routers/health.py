"""Health check router."""

from fastapi import APIRouter, Depends

from h10s.config import AppSettings, get_settings
from h10s.schema.api import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: AppSettings = Depends(get_settings)) -> HealthResponse:
    """Health check endpoint.

    Returns:
        Health status response
    """
    return HealthResponse(environment=settings.environment)
