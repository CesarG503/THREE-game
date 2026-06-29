import { apiFetch } from "../platform/api";
import { getStoredAuth } from "../platform/auth";

class AnalyticsTracker {
  private sessionStartTime: number;
  private totalIdleTimeMs: number = 0;
  private lastInactiveStart: number | null = null;
  private isActive: boolean = true;
  private heartbeatInterval: number | null = null;
  private latencySum: number = 0;
  private latencyCount: number = 0;
  private hasSentEnd: boolean = false;

  constructor() {
    this.sessionStartTime = Date.now();
    this.isActive = document.visibilityState === "visible";
    if (!this.isActive) {
      this.lastInactiveStart = Date.now();
    }
  }

  public init() {
    // 1. Send SessionStart
    this.sendSessionStart();

    // 2. Listen to visibility and focus changes
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);

    // 3. Start Heartbeat
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, 60000);

    // 4. Listen to Unload events reliably
    window.addEventListener("pagehide", this.handleUnload);
    window.addEventListener("beforeunload", this.handleUnload);
  }

  private handleVisibilityChange = () => {
    this.updateState(document.visibilityState === "visible");
  };

  private handleBlur = () => {
    this.updateState(false);
  };

  private handleFocus = () => {
    this.updateState(true);
  };

  private updateState(active: boolean) {
    if (this.isActive === active) return;
    
    this.isActive = active;
    const now = Date.now();

    if (!active) {
      // Transitioning to inactive
      this.lastInactiveStart = now;
    } else {
      // Transitioning back to active
      if (this.lastInactiveStart !== null) {
        this.totalIdleTimeMs += (now - this.lastInactiveStart);
        this.lastInactiveStart = null;
      }
    }
  }

  private buildEnvelope(eventType: string, payload: any) {
    const auth = getStoredAuth();
    return {
      id: crypto.randomUUID(),
      eventType,
      userId: auth?.user.id ?? null,
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  private async trackLatencyCall<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const res = await fn();
      const elapsed = Date.now() - start;
      this.latencySum += elapsed;
      this.latencyCount++;
      return res;
    } catch (err) {
      throw err;
    }
  }

  private sendSessionStart() {
    const payload = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
    
    const envelope = this.buildEnvelope("SessionStart", payload);
    
    this.trackLatencyCall(() =>
      apiFetch("/analytics/event", {
        method: "POST",
        body: JSON.stringify(envelope),
        auth: false,
      })
    ).catch(console.warn);
  }

  private sendHeartbeat() {
    const envelope = this.buildEnvelope("SessionHeartbeat", {
      state: this.isActive ? "tab_active" : "tab_inactive"
    });

    this.trackLatencyCall(() =>
      apiFetch("/analytics/event", {
        method: "POST",
        body: JSON.stringify(envelope),
        auth: false,
      })
    ).catch(console.warn);
  }

  private handleUnload = () => {
    if (this.hasSentEnd) return;
    this.hasSentEnd = true;

    // Force final idle calculation if we were inactive
    this.updateState(false); 

    const now = Date.now();
    const durationSeconds = Math.floor((now - this.sessionStartTime) / 1000);
    const idleSeconds = Math.floor(this.totalIdleTimeMs / 1000);
    const usefulSeconds = Math.max(0, durationSeconds - idleSeconds);
    const averageLatencyMs = this.latencyCount > 0 ? Math.round(this.latencySum / this.latencyCount) : undefined;

    const envelope = this.buildEnvelope("SessionEnd", {
      durationSeconds,
      idleSeconds,
      usefulSeconds,
      averageLatencyMs,
    });

    // Use sendBeacon for reliable delivery during page unload
    // Note: URL must be absolute or relative to origin.
    const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/event", blob);
  };
}

export const analytics = new AnalyticsTracker();
