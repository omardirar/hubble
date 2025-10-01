# Observability Integration Roadmap

This document outlines the planned integration of OpenTelemetry and enhanced observability features for the Hubble platform.

## Overview

The current logger package provides structured logging with performance monitoring. The next phase will add distributed tracing, metrics collection, and enhanced observability using OpenTelemetry.

## Planned Features

### 1. OpenTelemetry Integration

#### Traces

- **Distributed Tracing**: Track requests across services with correlation IDs
- **Span Attribution**: Automatic span creation for API routes, database queries, and external calls
- **Context Propagation**: W3C Trace Context headers for cross-service tracing
- **Custom Spans**: Manual instrumentation for business-critical operations

#### Metrics

- **Request Metrics**: Latency, throughput, error rates by endpoint
- **Database Metrics**: Query duration, connection pool stats, error rates
- **Business Metrics**: Custom counters for feature usage, conversions
- **Resource Metrics**: Memory, CPU, active connections

#### Logs

- **Log Correlation**: Associate logs with trace spans
- **Structured Export**: Export logs to observability backends
- **Log Sampling**: Intelligent sampling based on trace decisions

### 2. Observability Backends

#### Supported Exporters

- **Jaeger**: Distributed tracing visualization
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Unified dashboards for logs, metrics, traces
- **DataDog**: Commercial APM solution (optional)
- **New Relic**: Commercial observability platform (optional)

### 3. Enhanced UI Error Notifications

#### Toast Notifications (Sonner)

- **Error Boundary Integration**: Automatic toasts for React errors
- **API Error Handling**: User-friendly error messages for failed requests
- **Validation Errors**: Inline validation with toast summaries
- **Success Notifications**: Confirmation toasts for successful operations

#### Error Categories

- **Network Errors**: Connection issues, timeouts
- **Authentication Errors**: Token expiry, permission denied
- **Validation Errors**: Form validation, schema mismatches
- **Server Errors**: 500s, database errors, external service failures

## Implementation Plan

### Phase 1: Foundation (Milestone 0.1.0)

- [ ] Add OpenTelemetry SDK dependencies
- [ ] Configure OTLP exporters for traces and metrics
- [ ] Create trace provider with resource detection
- [ ] Implement automatic HTTP instrumentation
- [ ] Add span creation to performance wrappers
- [ ] Configure trace context propagation

### Phase 2: Instrumentation (Milestone 0.1.0)

- [ ] Instrument API route handlers with spans
- [ ] Add database query tracing
- [ ] Implement custom spans for chat operations
- [ ] Add metrics collection for key endpoints
- [ ] Create custom metrics for business KPIs

### Phase 3: UI Enhancements (Milestone 0.0.2)

- [ ] Integrate Sonner toast library
- [ ] Add toast notifications to error boundary
- [ ] Create error toast helper utilities
- [ ] Add success/info toasts to chat service
- [ ] Implement retry mechanisms with toast feedback

### Phase 4: Dashboards & Alerts (Milestone 0.2.0)

- [ ] Create Grafana dashboards for key metrics
- [ ] Configure Prometheus alerting rules
- [ ] Set up error rate alerts
- [ ] Create performance degradation alerts
- [ ] Implement SLO monitoring

## Configuration

### Environment Variables

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_SERVICE_NAME=hubble-web
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces

# Metrics Configuration
OTEL_METRICS_EXPORTER=prometheus
OTEL_METRICS_EXPORT_INTERVAL=60000  # 1 minute

# Resource Attributes
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0
```

### Code Examples

#### Trace API Route

```typescript
import { trace } from "@opentelemetry/api"
import { createApiHandler } from "@hubble/server"

export const POST = createApiHandler(
  async (request, auth, logger) => {
    const tracer = trace.getTracer("hubble-api")

    return await tracer.startActiveSpan("process-payment", async (span) => {
      try {
        span.setAttribute("user.id", auth.userId)
        span.setAttribute("payment.amount", amount)

        const result = await processPayment(amount)
        span.setStatus({ code: SpanStatusCode.OK })

        return NextResponse.json(result)
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        })
        span.recordException(error)
        throw error
      } finally {
        span.end()
      }
    })
  },
  { requireAuth: true },
)
```

#### Custom Metrics

```typescript
import { metrics } from "@opentelemetry/api"

const meter = metrics.getMeter("hubble-chat")
const messageCounter = meter.createCounter("chat.messages.sent", {
  description: "Number of chat messages sent",
})
const responseLatency = meter.createHistogram("chat.ai.response.duration", {
  description: "AI response latency in milliseconds",
  unit: "ms",
})

// In chat service
chatLogger.messageSent(conversationId, userId, messageLength)
messageCounter.add(1, {
  conversationId,
  userId,
  messageType: "user",
})
```

#### Error Toast Integration

```typescript
import { toast } from "sonner"
import { ErrorBoundary } from "@hubble/logger"

<ErrorBoundary
  componentName="ChatPanel"
  onError={(error) => {
    toast.error("Chat unavailable", {
      description: "We're having trouble loading your conversations. Please try again.",
      action: {
        label: "Retry",
        onClick: () => window.location.reload(),
      },
    })
  }}
>
  <ChatPanel />
</ErrorBoundary>
```

## Benefits

### For Developers

- **Faster Debugging**: Trace requests across services to identify bottlenecks
- **Performance Insights**: Understand query performance and optimize critical paths
- **Error Context**: Rich error context with full trace history

### For Operations

- **Proactive Monitoring**: Alerts before users report issues
- **Capacity Planning**: Understand resource usage patterns
- **SLA Compliance**: Monitor and report on service level objectives

### For Users

- **Better UX**: Clear error messages with actionable guidance
- **Faster Resolution**: Issues identified and fixed before widespread impact
- **Transparency**: Status updates during degraded service

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Tracing](https://www.jaegertracing.io/)
- [Prometheus Metrics](https://prometheus.io/)
- [Grafana Dashboards](https://grafana.com/)
- [Sonner Toast](https://sonner.emilkowal.ski/)

## Related TODOs

Track implementation progress via GitHub issues automatically created from inline TODOs:

- OpenTelemetry integration in logger config
- Span creation in performance utilities
- Context propagation in API handlers
- Toast notifications in error boundary
- Chat service error handling with toasts
- Middleware automatic instrumentation
