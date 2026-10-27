import type { GameMode, Route } from "../types";

type RouteListener = (route: Route) => void;

export class Router {
  currentRoute: Route;
  listeners: RouteListener[];

  constructor() {
    this.currentRoute = this.parseUrl();
    this.listeners = [];

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => {
        this.currentRoute = this.parseUrl();
        this.notify();
      });
    }
  }

  parseUrl(): Route {
    if (typeof window === "undefined") {
      return { mode: "lobby", roomId: null };
    }
    const path = window.location.pathname;
    if (
      path.startsWith("/dev/death-lab") ||
      path === "/death-lab" ||
      window.location.hash === "#death-lab" ||
      window.location.search.includes("death-lab")
    ) {
      return { mode: "death-lab", roomId: null };
    }
    const segments = path.split("/").filter(Boolean);
    if (segments[0] === "dev" && segments[1] === "death-lab") {
      return { mode: "death-lab", roomId: null };
    }
    const mode = this.resolveMode(segments[0]);
    const roomId = segments[1] ?? null;
    return { mode, roomId };
  }

  resolveMode(segment?: string): GameMode {
    if (segment === "dev" || segment === "death-lab") return "death-lab";
    if (segment === "editor") return "editor";
    if (segment === "play") return "play";
    return "lobby";
  }

  navigate(mode: GameMode, roomId: string | null = null) {
    let path: string;
    if (mode === "death-lab") {
      path = "/dev/death-lab";
    } else {
      path = roomId ? `/${mode}/${roomId}` : `/${mode}`;
    }
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", path);
    }
    this.currentRoute = { mode, roomId: mode === "death-lab" ? null : roomId };
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
