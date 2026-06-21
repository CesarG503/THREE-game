import { getStoredAuth } from "../platform/auth";
import { getApiBaseUrl } from "../platform/api";

class EditorTelemetry {
  private flushIntervalId: number | null = null;
  private sessionStartTime: number = 0;
  
  // Buffers for actions (objectType -> count)
  private placeCounts: Map<string, number> = new Map();
  private deleteCounts: Map<string, number> = new Map();

  constructor() {}

  private sendEvent(eventType: string, payload: any) {
    const auth = getStoredAuth();
    const envelope = {
      id: crypto.randomUUID(),
      eventType,
      userId: auth ? auth.user.id : null,
      timestamp: new Date().toISOString(),
      payload,
    };

    try {
      const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
      // sendBeacon guarantees delivery even if the page unloads
      navigator.sendBeacon(`${getApiBaseUrl()}/analytics/event`, blob);
    } catch (err) {
      console.warn("[EditorTelemetry] beacon failed", err);
    }
  }

  public startSession() {
    this.sessionStartTime = Date.now();
    this.placeCounts.clear();
    this.deleteCounts.clear();
    
    this.sendEvent("EditorSession", { action: "open" });

    // Flush every 10 seconds to avoid blocking main thread when placing rapidly
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }
    this.flushIntervalId = window.setInterval(() => this.flush(), 10000);
  }

  public trackPlacement(objectType: string) {
    if (!this.sessionStartTime) return;
    const current = this.placeCounts.get(objectType) || 0;
    this.placeCounts.set(objectType, current + 1);
  }

  public trackDeletion(objectType: string) {
    if (!this.sessionStartTime) return;
    const current = this.deleteCounts.get(objectType) || 0;
    this.deleteCounts.set(objectType, current + 1);
  }

  public trackMapState(state: "saved_local" | "published", mapId?: string) {
    this.sendEvent("MapStateTransition", {
      state,
      mapId: mapId || null
    });
  }

  public flush() {
    this.placeCounts.forEach((count, objType) => {
      this.sendEvent("EditorAction", { action: "place", objectType: objType, count });
    });
    this.placeCounts.clear();

    this.deleteCounts.forEach((count, objType) => {
      this.sendEvent("EditorAction", { action: "delete", objectType: objType, count });
    });
    this.deleteCounts.clear();
  }

  public endSession() {
    if (!this.sessionStartTime) return;
    
    this.flush(); // Flush any remaining actions in buffer
    
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    const durationSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    this.sendEvent("EditorSession", {
      action: "close",
      durationSeconds
    });

    this.sessionStartTime = 0;
  }
}

export const editorTelemetry = new EditorTelemetry();
