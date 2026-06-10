import type { GameMode, Route } from "../types";

type RouteListener = (route: Route) => void;

export class Router {
  currentRoute: Route;
  listeners: RouteListener[];

  constructor() {
    this.currentRoute = this.parseUrl();
    this.listeners = [];

    window.addEventListener("popstate", () => {
      this.currentRoute = this.parseUrl();
      this.notify();
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
    this.currentRoute = { mode, roomId };
    this.notify();
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
}
