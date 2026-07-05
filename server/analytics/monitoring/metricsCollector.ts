import { eventBuffer } from "../eventBuffer.js";
import { logger } from "../../utils/Logger.js";
import { alertService } from "./alerts.js";

export class MetricsCollector {
  private receivedCounts = new Map<string, number>();
  private persistedCounts = new Map<string, number>();
  private failedCounts = new Map<string, number>();
  private latencies: number[] = [];
  private readonly maxLatencyWindowSize = 1000;

  private lastProcessingOverheadMs = 0;
  private totalProcessingOverheadsCount = 0;
  private totalProcessingOverheadsSum = 0;

  private alertActive = false;
  private lastAlertTime = 0;

  constructor() {}

  public recordReceived(eventType: string, count = 1) {
    const current = this.receivedCounts.get(eventType) ?? 0;
    this.receivedCounts.set(eventType, current + count);
    alertService.recordReceived(eventType);
  }

  public recordPersisted(eventType: string, count = 1) {
    const current = this.persistedCounts.get(eventType) ?? 0;
    this.persistedCounts.set(eventType, current + count);
  }

  public recordFailed(eventType: string, count = 1) {
    const current = this.failedCounts.get(eventType) ?? 0;
    this.failedCounts.set(eventType, current + count);
  }

  public recordLatency(latencyMs: number) {
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencyWindowSize) {
      this.latencies.shift();
    }
  }

  public recordLatencies(newLatencies: number[]) {
    if (newLatencies.length === 0) return;
    for (const lat of newLatencies) {
      this.latencies.push(lat);
      if (this.latencies.length > this.maxLatencyWindowSize) {
        this.latencies.shift();
      }
    }
    this.checkAlerts();
  }

  public recordProcessingOverhead(overheadMs: number) {
    this.lastProcessingOverheadMs = overheadMs;
    this.totalProcessingOverheadsSum += overheadMs;
    this.totalProcessingOverheadsCount++;
  }

  public getPercentile(p: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (p / 100));
    return sorted[index] ?? 0;
  }

  public isAlertActive(): boolean {
    return this.alertActive;
  }

  private checkAlerts() {
    const p95 = this.getPercentile(95);
    const now = Date.now();
    if (p95 > 2000) {
      if (!this.alertActive || now - this.lastAlertTime > 60000) {
        logger.error(
          "TelemetryAlert",
          `CRITICAL: Percentil 95 (P95) de latencia excede el límite de 2 segundos. P95 actual: ${p95}ms`
        );
        this.alertActive = true;
        this.lastAlertTime = now;
      }
    } else {
      if (this.alertActive) {
        logger.info(
          "TelemetryAlert",
          `RESOLVED: Latencia P95 ha retornado a la normalidad: ${p95}ms`
        );
        this.alertActive = false;
      }
    }
  }

  public clear(): void {
    this.receivedCounts.clear();
    this.persistedCounts.clear();
    this.failedCounts.clear();
    this.latencies = [];
    this.lastProcessingOverheadMs = 0;
    this.totalProcessingOverheadsCount = 0;
    this.totalProcessingOverheadsSum = 0;
    this.alertActive = false;
    this.lastAlertTime = 0;
  }

  public toPrometheusFormat(): string {
    const lines: string[] = [];

    // Helper to add help and type headers
    const addHeader = (name: string, type: string, help: string) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
    };

    // Received Counter
    addHeader("telemetry_events_received_total", "counter", "Total telemetry events received by the HTTP endpoint.");
    const allEventTypes = new Set([
      ...this.receivedCounts.keys(),
      ...this.persistedCounts.keys(),
      ...this.failedCounts.keys(),
    ]);

    for (const eventType of allEventTypes) {
      const received = this.receivedCounts.get(eventType) ?? 0;
      lines.push(`telemetry_events_received_total{event_type="${eventType}"} ${received}`);
    }

    // Persisted Counter
    addHeader("telemetry_events_persisted_total", "counter", "Total telemetry events successfully persisted to database.");
    for (const eventType of allEventTypes) {
      const persisted = this.persistedCounts.get(eventType) ?? 0;
      lines.push(`telemetry_events_persisted_total{event_type="${eventType}"} ${persisted}`);
    }

    // Failed Counter
    addHeader("telemetry_events_failed_total", "counter", "Total telemetry events that failed processing/insertion.");
    for (const eventType of allEventTypes) {
      const failed = this.failedCounts.get(eventType) ?? 0;
      lines.push(`telemetry_events_failed_total{event_type="${eventType}"} ${failed}`);
    }

    // Latency Percentiles (Gauges)
    addHeader("telemetry_event_latency_ms", "gauge", "End-to-end event latency in milliseconds at percentiles.");
    lines.push(`telemetry_event_latency_ms{percentile="50"} ${this.getPercentile(50)}`);
    lines.push(`telemetry_event_latency_ms{percentile="95"} ${this.getPercentile(95)}`);
    lines.push(`telemetry_event_latency_ms{percentile="99"} ${this.getPercentile(99)}`);

    // Processing Overhead Gauge
    addHeader("telemetry_processing_overhead_ms", "gauge", "Duration of the last database persistence batch in milliseconds.");
    lines.push(`telemetry_processing_overhead_ms ${this.lastProcessingOverheadMs}`);

    // Processing Overhead Sum Counter
    addHeader("telemetry_processing_overhead_sum_ms", "counter", "Accumulated database persistence duration in milliseconds.");
    lines.push(`telemetry_processing_overhead_sum_ms ${this.totalProcessingOverheadsSum}`);

    // Processing Overhead Count Counter
    addHeader("telemetry_processing_overhead_count", "counter", "Total number of persistence batches processed.");
    lines.push(`telemetry_processing_overhead_count ${this.totalProcessingOverheadsCount}`);

    // Queue Backpressure Gauge
    addHeader("telemetry_queue_backpressure_events", "gauge", "Current number of events waiting in the client-side or memory buffer.");
    lines.push(`telemetry_queue_backpressure_events ${eventBuffer.getLength()}`);

    // Alert Status Gauge
    addHeader("telemetry_alert_active", "gauge", "Status of the telemetry latency alert (1 = active, 0 = inactive).");
    lines.push(`telemetry_alert_active ${this.alertActive ? 1 : 0}`);

    return lines.join("\n") + "\n";
  }
}

export const metricsCollector = new MetricsCollector();
