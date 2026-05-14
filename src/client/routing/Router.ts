export class Router {
  currentRoute: any;
  listeners: any[];

  constructor() {
    this.currentRoute = this.parseUrl();
    this.listeners = [];

    window.addEventListener("popstate", () => {
      this.currentRoute = this.parseUrl();
      this.notify();
    });
  }

  parseUrl() {
    const path = window.location.pathname;
    const segments = path.split("/").filter(Boolean);
    const mode = this.resolveMode(segments[0]);
    const roomId = segments[1] ?? null;
    return { mode, roomId };
  }

  resolveMode(segment: any) {
    if (segment === "editor") return "editor";
    if (segment === "play") return "play";
    return "lobby";
  }

  navigate(mode: any, roomId: any = null) {
    const path = roomId ? `/${mode}/${roomId}` : `/${mode}`;
    window.history.pushState(null, "", path);
    this.currentRoute = { mode, roomId };
    this.notify();
  }

  getMode() {
    return this.currentRoute.mode;
  }

  getRoomId() {
    return this.currentRoute.roomId;
  }

  onChange(cb: any) {
    this.listeners.push(cb);
  }

  notify() {
    this.listeners.forEach((cb: any) => cb(this.currentRoute));
  }
}
