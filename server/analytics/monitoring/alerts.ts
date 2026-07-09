import { request } from "node:http";
import { request as httpsRequest } from "node:https";
import { analyticsPrisma } from "../../db/analyticsPrisma.js";
import { logger } from "../../utils/Logger.js";

export class TelemetryAlertService {
  private lastReceivedTimes = new Map<string, number>();
  private receivedTimestamps = new Map<string, number[]>();
  private activeAlerts = new Map<string, boolean>();
  
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly criticalEventTypes = ["MatchJoin", "SessionStart"];
  private startTime = Date.now();
  private webhookUrl: string | null = null;

  constructor() {
    this.webhookUrl = process.env.TELEMETRY_ALERT_WEBHOOK_URL || null;
  }

  public recordReceived(eventType: string) {
    const now = Date.now();
    this.lastReceivedTimes.set(eventType, now);

    let list = this.receivedTimestamps.get(eventType);
    if (!list) {
      list = [];
      this.receivedTimestamps.set(eventType, list);
    }
    list.push(now);
  }

  public setWebhookUrl(url: string | null) {
    this.webhookUrl = url;
  }

  public start(intervalMs = 60000) {
    if (this.checkInterval) return;
    
    // Initialize critical events last received to current time so we don't instantly alert
    const now = Date.now();
    for (const et of this.criticalEventTypes) {
      if (!this.lastReceivedTimes.has(et)) {
        this.lastReceivedTimes.set(et, now);
      }
    }

    this.checkInterval = setInterval(() => {
      this.checkAllAlerts().catch((err) => {
        logger.error("TelemetryAlert", "Error running checkAllAlerts", err);
      });
    }, intervalMs);
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public clear() {
    this.lastReceivedTimes.clear();
    this.receivedTimestamps.clear();
    this.activeAlerts.clear();
    this.startTime = Date.now();
  }

  public getActiveAlerts(): Map<string, boolean> {
    return new Map(this.activeAlerts);
  }

  public async checkAllAlerts() {
    const now = Date.now();
    
    // 1. Detección de Silencio (Event Silence)
    for (const eventType of this.criticalEventTypes) {
      const lastTime = this.lastReceivedTimes.get(eventType) ?? this.startTime;
      const elapsedMs = now - lastTime;
      const alertKey = `silence_${eventType}`;

      if (elapsedMs > 15 * 60 * 1000) {
        if (!this.activeAlerts.get(alertKey)) {
          this.activeAlerts.set(alertKey, true);
          this.triggerAlert(
            alertKey,
            `CRITICAL: Alerta de silencio para ${eventType}. No se han recibido eventos en los últimos ${(elapsedMs / 1000 / 60).toFixed(1)} minutos.`
          );
        }
      } else {
        if (this.activeAlerts.get(alertKey)) {
          this.activeAlerts.set(alertKey, false);
          this.triggerAlert(
            alertKey,
            `RESOLVED: Alerta de silencio para ${eventType} solucionada. Eventos recibidos nuevamente.`,
            false
          );
        }
      }
    }

    // 2. Umbrales Dinámicos Adaptativos (Caídas de Ingesta)
    for (const eventType of this.criticalEventTypes) {
      // Limpiar y obtener tasa de eventos de los últimos 15 minutos en memoria
      const currentCount = this.cleanAndGetCount(eventType, now);
      const alertKey = `drop_${eventType}`;

      try {
        // Calcular promedio histórico de los últimos 7 días en el mismo bloque de 15 minutos
        const avgExpected = await this.getHistoricalAverage(eventType);
        
        // Evitamos falsos positivos en periodos de nula o muy baja concurrencia
        if (avgExpected < 10) {
          continue;
        }

        // Si cae a menos del 30% del volumen promedio esperado, se activa la alerta
        const threshold = avgExpected * 0.3;
        if (currentCount < threshold) {
          if (!this.activeAlerts.get(alertKey)) {
            this.activeAlerts.set(alertKey, true);
            this.triggerAlert(
              alertKey,
              `CRITICAL: Caída abrupta en la tasa de eventos de tipo ${eventType}. Actual: ${currentCount} (Esperado: ~${avgExpected.toFixed(1)})`
            );
          }
        } else {
          if (this.activeAlerts.get(alertKey)) {
            this.activeAlerts.set(alertKey, false);
            this.triggerAlert(
              alertKey,
              `RESOLVED: Tasa de eventos de tipo ${eventType} normalizada. Actual: ${currentCount} (Esperado: ~${avgExpected.toFixed(1)})`,
              false
            );
          }
        }
      } catch (err) {
        logger.error("TelemetryAlert", `Failed to evaluate historical thresholds for ${eventType}`, err);
      }
    }
  }

  private cleanAndGetCount(eventType: string, now: number): number {
    const list = this.receivedTimestamps.get(eventType) ?? [];
    const limit = now - 15 * 60 * 1000;
    while (list.length > 0 && list[0] !== undefined && list[0] < limit) {
      list.shift();
    }
    return list.length;
  }

  private async getHistoricalAverage(eventType: string): Promise<number> {
    const now = new Date();
    const dayOffset = 24 * 60 * 60 * 1000;
    const windowMs = 15 * 60 * 1000;
    let totalCount = 0;
    let validDays = 0;

    for (let i = 1; i <= 7; i++) {
      const targetStart = new Date(now.getTime() - i * dayOffset - windowMs);
      const targetEnd = new Date(now.getTime() - i * dayOffset);
      
      try {
        const count = await analyticsPrisma.rawEvent.count({
          where: {
            eventType,
            timestamp: {
              gte: targetStart,
              lte: targetEnd
            }
          }
        });
        totalCount += count;
        validDays++;
      } catch (err) {
        logger.error("TelemetryAlert", `Error fetching count for day -${i} for eventType ${eventType}`, err);
      }
    }

    return validDays > 0 ? totalCount / validDays : 0;
  }

  private triggerAlert(alertKey: string, message: string, isCritical = true) {
    if (isCritical) {
      logger.error("TelemetryAlert", message);
    } else {
      logger.info("TelemetryAlert", message);
    }

    if (this.webhookUrl) {
      this.sendWebhook(message);
    }
  }

  private sendWebhook(message: string) {
    try {
      const url = new URL(this.webhookUrl!);
      const payload = JSON.stringify({ text: message, content: message });
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      };

      const requestFn = url.protocol === "https:" ? httpsRequest : request;
      const req = requestFn(reqOptions, (res) => {
        res.resume();
      });

      req.on("error", (err) => {
        logger.error("TelemetryAlert", `Failed to send webhook: ${err.message}`);
      });

      req.write(payload);
      req.end();
    } catch (err: any) {
      logger.error("TelemetryAlert", `Webhook error: ${err.message}`);
    }
  }
}

export const alertService = new TelemetryAlertService();
