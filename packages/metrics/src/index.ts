/**
 * Metrics Collection and Monitoring
 *
 * Integrates with Grafana Cloud Prometheus for comprehensive observability
 * including API performance, cache statistics, error rates, and business metrics.
 */

// Note: Logger import removed to avoid circular dependencies
// TODO: Add proper logging once logger package is properly configured

// Grafana Cloud configuration
interface GrafanaCloudConfig {
  prometheusUrl: string
  username: string
  password: string
}

const grafanaConfig: GrafanaCloudConfig = {
  prometheusUrl: process.env.GRAFANA_CLOUD_PROMETHEUS_URL || "",
  username: process.env.GRAFANA_CLOUD_PROMETHEUS_USERNAME || "",
  password: process.env.GRAFANA_CLOUD_PROMETHEUS_PASSWORD || "",
}

// In-memory metrics buffer for batching
interface MetricData {
  name: string
  value: number
  labels?: Record<string, string>
  timestamp: number
  type: "counter" | "gauge" | "histogram" | "summary"
}

class MetricsBuffer {
  private buffer: MetricData[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly maxBufferSize = 1000
  private readonly flushIntervalMs = 10000 // 10 seconds

  constructor() {
    this.startPeriodicFlush()
  }

  addMetric(metric: MetricData): void {
    this.buffer.push(metric)

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const metrics = [...this.buffer]
    this.buffer = []

    try {
      await this.sendToGrafana(metrics)
      // console.debug("metrics.flushed", { count: metrics.length })
    } catch (error) {
      // console.error("metrics.flush_failed", {
      //   error: error instanceof Error ? error.message : String(error),
      //   count: metrics.length
      // })

      // Put metrics back in buffer for retry
      this.buffer.unshift(...metrics)
    }
  }

  private async sendToGrafana(metrics: MetricData[]): Promise<void> {
    if (!grafanaConfig.prometheusUrl) {
      // If Grafana Cloud is not configured, just log metrics
      // console.info("metrics.would_send_to_grafana", {
      //   count: metrics.length,
      //   sample_metric: metrics[0]
      // })
      return
    }

    const prometheusFormat = this.formatForPrometheus(metrics)
    const auth = Buffer.from(`${grafanaConfig.username}:${grafanaConfig.password}`).toString(
      "base64",
    )

    const response = await fetch(grafanaConfig.prometheusUrl + "/metrics", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: `Basic ${auth}`,
      },
      body: prometheusFormat,
    })

    if (!response.ok) {
      throw new Error(`Grafana Cloud API error: ${response.status} ${response.statusText}`)
    }
  }

  private formatForPrometheus(metrics: MetricData[]): string {
    return metrics
      .map((metric) => {
        const labels = metric.labels
          ? Object.entries(metric.labels)
              .map(([key, value]) => `${key}="${value}"`)
              .join(",")
          : ""

        const labelString = labels ? `{${labels}}` : ""

        return `${metric.name}${labelString} ${metric.value} ${metric.timestamp * 1000}`
      })
      .join("\n")
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, this.flushIntervalMs)
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush() // Final flush
  }
}

// Global metrics buffer
const metricsBuffer = new MetricsBuffer()

/**
 * Core metrics collection class
 */
export class MetricsCollector {
  private static counters = new Map<string, number>()
  private static gauges = new Map<string, number>()
  private static histograms = new Map<string, number[]>()

  /**
   * Increment a counter metric
   */
  static counter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels)
    this.counters.set(key, (this.counters.get(key) || 0) + value)

    metricsBuffer.addMetric({
      name,
      value: this.counters.get(key)!,
      labels,
      timestamp: Math.floor(Date.now() / 1000),
      type: "counter",
    })
  }

  /**
   * Set a gauge metric
   */
  static gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels)
    this.gauges.set(key, value)

    metricsBuffer.addMetric({
      name,
      value,
      labels,
      timestamp: Math.floor(Date.now() / 1000),
      type: "gauge",
    })
  }

  /**
   * Record a histogram observation
   */
  static histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels)
    if (!this.histograms.has(key)) {
      this.histograms.set(key, [])
    }
    this.histograms.get(key)!.push(value)

    // Send histogram summary
    const observations = this.histograms.get(key)!
    const count = observations.length
    const sum = observations.reduce((a, b) => a + b, 0)
    const avg = sum / count

    metricsBuffer.addMetric({
      name: `${name}_count`,
      value: count,
      labels: { ...labels, quantile: "count" },
      timestamp: Math.floor(Date.now() / 1000),
      type: "gauge",
    })

    metricsBuffer.addMetric({
      name: `${name}_sum`,
      value: sum,
      labels: { ...labels, quantile: "sum" },
      timestamp: Math.floor(Date.now() / 1000),
      type: "counter",
    })

    metricsBuffer.addMetric({
      name: `${name}_avg`,
      value: avg,
      labels: { ...labels, quantile: "avg" },
      timestamp: Math.floor(Date.now() / 1000),
      type: "gauge",
    })
  }

  /**
   * Record timing information
   */
  static timing(name: string, durationMs: number, labels?: Record<string, string>): void {
    this.histogram(`${name}_duration_seconds`, durationMs / 1000, labels)
  }

  /**
   * Record API call metrics
   */
  static recordApiCall(
    endpoint: string,
    method: string,
    durationMs: number,
    statusCode: number,
    success: boolean = statusCode >= 200 && statusCode < 300,
  ): void {
    const labels = {
      endpoint,
      method,
      status_code: statusCode.toString(),
      success: success.toString(),
    }

    this.timing("api_call_duration", durationMs, labels)
    this.counter("api_calls_total", 1, labels)

    if (!success) {
      this.counter("api_errors_total", 1, { ...labels, error_type: "http_error" })
    }
  }

  /**
   * Record cache metrics
   */
  static recordCacheOperation(
    cacheName: string,
    operation: "hit" | "miss" | "set" | "delete" | "evict",
    durationMs?: number,
  ): void {
    const labels = { cache_name: cacheName, operation }

    this.counter(`cache_operations_total`, 1, labels)

    if (durationMs) {
      this.timing("cache_operation_duration", durationMs, labels)
    }
  }

  /**
   * Record retry metrics
   */
  static recordRetry(
    operation: string,
    attempt: number,
    success: boolean,
    durationMs: number,
  ): void {
    const labels = {
      operation,
      attempt: attempt.toString(),
      success: success.toString(),
    }

    this.counter("retry_attempts_total", 1, labels)
    this.timing("retry_duration", durationMs, labels)

    if (!success) {
      this.counter("retry_failures_total", 1, { operation })
    }
  }

  /**
   * Record rate limiter metrics
   */
  static recordRateLimit(limiterName: string, allowed: boolean, waitTimeMs?: number): void {
    const labels = {
      limiter_name: limiterName,
      allowed: allowed.toString(),
    }

    this.counter("rate_limit_events_total", 1, labels)

    if (waitTimeMs) {
      this.histogram("rate_limit_wait_time", waitTimeMs / 1000, labels)
    }
  }

  /**
   * Record circuit breaker metrics
   */
  static recordCircuitBreaker(
    breakerName: string,
    state: "closed" | "open" | "half-open",
    success: boolean,
  ): void {
    const labels = {
      breaker_name: breakerName,
      state,
      success: success.toString(),
    }

    this.gauge("circuit_breaker_state", state === "open" ? 1 : 0, { breaker_name: breakerName })
    this.counter("circuit_breaker_events_total", 1, labels)
  }

  /**
   * Record business metrics
   */
  static recordBusinessMetric(
    metricName: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    this.counter(metricName, value, labels)
  }

  private static getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name

    const sortedLabels = Object.keys(labels)
      .sort()
      .map((key) => `${key}=${labels[key]}`)
      .join(",")

    return `${name}{${sortedLabels}}`
  }

  /**
   * Get current metrics snapshot (for debugging)
   */
  static getSnapshot(): {
    counters: Record<string, number>
    gauges: Record<string, number>
    histograms: Record<string, { count: number; sum: number; avg: number }>
  } {
    const counters: Record<string, number> = {}
    for (const [key, value] of Array.from(this.counters.entries())) {
      counters[key] = value
    }

    const gauges: Record<string, number> = {}
    for (const [key, value] of Array.from(this.gauges.entries())) {
      gauges[key] = value
    }

    const histograms: Record<string, { count: number; sum: number; avg: number }> = {}
    for (const [key, observations] of Array.from(this.histograms.entries())) {
      const count = observations.length
      const sum = observations.reduce((a, b) => a + b, 0)
      histograms[key] = {
        count,
        sum,
        avg: count > 0 ? sum / count : 0,
      }
    }

    return { counters, gauges, histograms }
  }
}

/**
 * Performance monitoring decorator for methods
 */
export function monitored<T extends (...args: any[]) => Promise<any>>(
  metricName: string,
  options?: {
    includeArgs?: boolean
    includeResult?: boolean
    labels?: Record<string, string>
  },
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now()
      const labels = { ...options?.labels }

      try {
        // Add argument information to labels if requested
        if (options?.includeArgs) {
          labels.args = JSON.stringify(
            args.map((arg) => (typeof arg === "object" ? "[object]" : String(arg))),
          ).substring(0, 100) // Truncate to avoid label size limits
        }

        const result = await originalMethod.apply(this, args)
        const durationMs = Date.now() - startTime

        // Add result information to labels if requested
        if (options?.includeResult && result !== undefined) {
          labels.result_type = typeof result
          labels.result_size = JSON.stringify(result).length.toString()
        }

        MetricsCollector.timing(metricName, durationMs, labels)
        MetricsCollector.recordApiCall(metricName, "method", durationMs, 200, true)

        return result
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        labels.error = errorMessage
        MetricsCollector.timing(`${metricName}_error`, durationMs, labels)
        MetricsCollector.recordApiCall(metricName, "method", durationMs, 500, false)

        throw error
      }
    }

    return descriptor
  }
}

/**
 * Application-level metrics
 */
export class ApplicationMetrics {
  /**
   * Record provisioning workflow metrics
   */
  static recordProvisioning(
    orgId: string,
    correlationId: string,
    step: string,
    durationMs: number,
    success: boolean,
    errorMessage?: string,
  ): void {
    const labels = {
      org_id: orgId,
      correlation_id: correlationId,
      step,
      success: success.toString(),
    }

    if (errorMessage) {
      ;(labels as any).error_message = errorMessage
    }

    MetricsCollector.timing("provisioning_step_duration", durationMs, labels)
    MetricsCollector.counter("provisioning_steps_total", 1, labels)

    if (!success) {
      MetricsCollector.counter("provisioning_failures_total", 1, { step })
    }
  }

  /**
   * Record data connection metrics
   */
  static recordDataConnection(
    orgId: string,
    sourceType: string,
    operation: string,
    durationMs: number,
    success: boolean,
  ): void {
    const labels = {
      org_id: orgId,
      source_type: sourceType,
      operation,
      success: success.toString(),
    }

    MetricsCollector.timing("data_connection_operation_duration", durationMs, labels)
    MetricsCollector.counter("data_connection_operations_total", 1, labels)
  }

  /**
   * Record chat metrics
   */
  static recordChatInteraction(
    orgId: string,
    conversationId: string,
    operation: string,
    durationMs: number,
    success: boolean,
    messageCount?: number,
  ): void {
    const labels = {
      org_id: orgId,
      conversation_id: conversationId,
      operation,
      success: success.toString(),
    }

    if (messageCount) {
      ;(labels as any).message_count = messageCount.toString()
    }

    MetricsCollector.timing("chat_interaction_duration", durationMs, labels)
    MetricsCollector.counter("chat_interactions_total", 1, labels)
  }

  /**
   * Record authentication metrics
   */
  static recordAuthentication(
    userId: string,
    operation: string,
    durationMs: number,
    success: boolean,
    provider?: string,
  ): void {
    const labels = {
      user_id: userId,
      operation,
      success: success.toString(),
    }

    if (provider) {
      ;(labels as any).provider = provider
    }

    MetricsCollector.timing("authentication_duration", durationMs, labels)
    MetricsCollector.counter("authentication_events_total", 1, labels)
  }
}

/**
 * Health check metrics
 */
export class HealthMetrics {
  private static lastHealthCheck = 0
  private static healthStatus = "unknown"

  static recordHealthCheck(
    component: string,
    status: "healthy" | "unhealthy" | "degraded",
    durationMs: number,
    details?: Record<string, string>,
  ): void {
    const labels = {
      component,
      status,
      ...details,
    }

    this.lastHealthCheck = Date.now()
    this.healthStatus = status

    MetricsCollector.gauge("health_check_status", status === "healthy" ? 1 : 0, { component })
    MetricsCollector.timing("health_check_duration", durationMs, labels)
    MetricsCollector.counter("health_checks_total", 1, labels)
  }

  static getHealthStatus(): { status: string; lastCheck: number } {
    return {
      status: this.healthStatus,
      lastCheck: this.lastHealthCheck,
    }
  }
}

/**
 * Resource usage metrics
 */
export class ResourceMetrics {
  static recordMemoryUsage(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage()

      MetricsCollector.gauge("memory_usage_bytes", memUsage.heapUsed, {
        type: "heap_used",
      })
      MetricsCollector.gauge("memory_usage_bytes", memUsage.heapTotal, {
        type: "heap_total",
      })
      MetricsCollector.gauge("memory_usage_bytes", memUsage.external, {
        type: "external",
      })
    }
  }

  static recordCPUUsage(): void {
    // CPU usage tracking would require external libraries like 'pidusage'
    // For now, we'll skip this as it adds complexity
  }

  static recordDiskUsage(): void {
    // Disk usage tracking would require 'fs' stats
    // Implementation depends on deployment environment
  }
}

// Start periodic resource monitoring
setInterval(() => {
  ResourceMetrics.recordMemoryUsage()
}, 30000) // Every 30 seconds

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    metricsBuffer.destroy()
  })

  process.on("SIGINT", () => {
    metricsBuffer.destroy()
  })
}

// Exports are handled by the individual class exports above
