import type { GameMode, Route } from "../types";
import { getStoredAuth } from "../platform/auth";
import { apiFetch } from "../platform/api";

type RouteListener = (route: Route) => void;

export class Router {
  currentRoute: Route;
  listeners: RouteListener[];

  constructor() {
    this.currentRoute = this.parseUrl();
    this.listeners = [];

    // Report initial page view on client startup
    this.reportPageView(null, this.currentRoute);

    window.addEventListener("popstate", () => {
      const previous = { ...this.currentRoute };
      this.currentRoute = this.parseUrl();
      this.notify();
      this.reportPageView(previous, this.currentRoute);
    });
  }

  parseUrl(): Route {
    const path = window.location.pathname;
    const segments = path.split("/").filter(Boolean);
    const mode = this.resolveMode(segments[0]);
    const roomId = segments[1] ?? null;
    return { mode, roomId };
  }

  resolveMode(segment?: string): GameMode {
    if (segment === "editor") return "editor";
    if (segment === "play") return "play";
    return "lobby";
  }

  navigate(mode: GameMode, roomId: string | null = null) {
    const path = roomId ? `/${mode}/${roomId}` : `/${mode}`;
    window.history.pushState(null, "", path);
    const previous = { ...this.currentRoute };
    this.currentRoute = { mode, roomId };
    this.notify();
    this.reportPageView(previous, this.currentRoute);
  }

  getMode(): GameMode {
    return this.currentRoute.mode;
  }

  getRoomId(): string | null {
    return this.currentRoute.roomId;
  }

  onChange(cb: RouteListener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== cb);
    };
  }

  notify() {
    this.listeners.forEach((cb) => cb(this.currentRoute));
  }

  private reportPageView(from: Route | null, to: Route) {
    try {
      const auth = getStoredAuth();
      
      let guestId = localStorage.getItem("veta.guest_id");
      if (!guestId) {
        guestId = crypto.randomUUID();
        localStorage.setItem("veta.guest_id", guestId);
      }

      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const deviceType = isMobile ? "mobile" : "desktop";

      const fromRoutePath = from ? (from.roomId ? `/${from.mode}/${from.roomId}` : `/${from.mode}`) : null;
      const toRoutePath = to.roomId ? `/${to.mode}/${to.roomId}` : `/${to.mode}`;

      const payload = {
        fromRoute: fromRoutePath,
        toRoute: toRoutePath,
        guestId: auth ? null : guestId,
        deviceType,
      };

      const envelope = {
        id: crypto.randomUUID(),
        eventType: "PageView",
        userId: auth?.user.id ?? null,
        timestamp: new Date().toISOString(),
        payload,
      };

      // Ship telemetry non-blocking
      apiFetch("/analytics/event", {
        method: "POST",
        body: JSON.stringify(envelope),
        auth: false,
      }).catch((err) => {
        console.warn("[Analytics] Failed to report PageView:", err);
      });
    } catch (e) {
      console.warn("[Analytics] Error in reportPageView:", e);
    }
  }
}
