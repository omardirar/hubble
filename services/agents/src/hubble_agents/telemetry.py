"""OpenTelemetry configuration helpers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from .config.settings import Settings

logger = logging.getLogger(__name__)
_configured = False


def configure_telemetry(app: FastAPI, settings: Settings) -> None:
    """Configure OpenTelemetry exporters and instrumentation if enabled."""

    global _configured

    if _configured:
        return

    if not settings.otel_endpoint:
        logger.info("OpenTelemetry exporter disabled; OTEL_EXPORTER_OTLP_ENDPOINT not set")
        return

    headers: dict[str, Any] | None = None
    if settings.otel_signoz_ingestion_key:
        headers = {"signoz-ingestion-key": settings.otel_signoz_ingestion_key.get_secret_value()}

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "deployment.environment": settings.environment,
        }
    )

    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint, headers=headers)
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()

    _configured = True
    logger.info("OpenTelemetry configured endpoint=%s", settings.otel_endpoint)


__all__ = ["configure_telemetry"]
