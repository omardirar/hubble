"""OpenTelemetry tracing configuration."""

from __future__ import annotations

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from h10s.config import AppSettings


def configure_tracing(app: FastAPI, settings: AppSettings) -> None:
    """Configure an OTLP exporter if telemetry is enabled."""

    if not settings.telemetry_endpoint:
        return

    provider = TracerProvider()
    exporter = OTLPSpanExporter(endpoint=f"{settings.telemetry_endpoint}/v1/traces")
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)


__all__ = ["configure_tracing"]
