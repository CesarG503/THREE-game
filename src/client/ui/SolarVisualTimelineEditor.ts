import "iconify-icon";
import { createIcon } from "./platform/dom";
import { calculateSolarCyclePosition } from "../platform/timelineDefaults";
import { normalizeSolarVisualTimeline, sampleSolarVisualPoints, solarPointTime, formatSolarPointTime, type CelestialBody, type SolarVisualPoint, type SolarVisualTimeline } from "../platform/solarVisualTimeline";

interface Host {
  getConfig: () => any;
  update: (patch: any) => void;
  refresh: () => void;
}

export class SolarVisualTimelineEditor {
  readonly element = document.createElement("div");
  body: CelestialBody = "sun";
  private selected: Record<CelestialBody, string | null> = { sun: null, moon: null };
  private pointSelect = document.createElement("select");
  private timeInput = document.createElement("input");
  private colorInput = document.createElement("input");
  private deleteButton: HTMLButtonElement;
  private addButton: HTMLButtonElement;
  private bodyButtons = new Map<CelestialBody, HTMLButtonElement>();
  private sliders = new Map<string, { input: HTMLInputElement; value: HTMLElement }>();
  private optionsKey = "";

  constructor(private host: Host) {
    this.element.style.cssText = "display:flex;flex-direction:column;gap:8px;min-width:0;font-size:12px;";
    const toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    const button = (label: string, icon: string, action: () => void) => {
      const el = document.createElement("button");
      el.type = "button";
      el.title = label;
      el.setAttribute("aria-label", label);
      el.style.cssText = "display:flex;align-items:center;justify-content:center;gap:5px;min-width:30px;height:30px;border:1px solid #555;border-radius:4px;background:#252525;color:#eee;cursor:pointer;";
      const symbol = createIcon(`lucide:${icon}`);
      symbol.style.cssText = "width:16px;height:16px;font-size:16px;";
      el.append(symbol);
      el.onclick = action;
      return el;
    };
    for (const body of ["sun", "moon"] as const) {
      const el = button(body === "sun" ? "Sol" : "Luna", body, () => {
        this.body = body;
        this.refresh();
        this.selectPoint(this.selectedId!);
      });
      el.append(document.createTextNode(body === "sun" ? "Sol" : "Luna"));
      this.bodyButtons.set(body, el);
      toolbar.append(el);
    }
    this.pointSelect.setAttribute("aria-label", "Punto de la trayectoria");
    this.pointSelect.style.cssText = "flex:1;min-width:100px;height:30px;background:#252525;color:#fff;border:1px solid #555;border-radius:4px;";
    this.pointSelect.onchange = () => this.selectPoint(this.pointSelect.value);
    toolbar.append(this.pointSelect);
    this.addButton = button("Añadir punto", "plus", () => this.addPoint());
    this.deleteButton = button("Eliminar punto", "trash-2", () => this.deletePoint());
    toolbar.append(this.addButton, this.deleteButton);
    this.element.append(toolbar);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;";
    const field = (label: string, input: HTMLElement) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;color:#ddd;";
      wrap.append(document.createTextNode(label), input);
      grid.append(wrap);
    };
    this.timeInput.type = "time";
    this.timeInput.step = "60";
    this.timeInput.required = true;
    this.timeInput.style.cssText = "width:100%;box-sizing:border-box;min-width:0;background:#252525;color:white;border:1px solid #555;border-radius:4px;height:28px;";
    this.timeInput.onchange = () => {
      if (!this.timeInput.value) return this.refresh();
      const [hours, minutes] = this.timeInput.value.split(":").map(Number);
      if (!this.updatePoint({ time: hours + minutes / 60 })) {
        this.timeInput.setCustomValidity("Ya existe un punto a esta hora.");
        this.timeInput.reportValidity();
      }
    };
    this.timeInput.oninput = () => this.timeInput.setCustomValidity("");
    field("Hora del punto", this.timeInput);
    this.colorInput.type = "color";
    this.colorInput.style.cssText = "height:28px;width:100%;padding:0;border:1px solid #555;background:none;";
    this.colorInput.oninput = () => this.updatePoint({ color: this.colorInput.value });
    field("Color", this.colorInput);
    for (const [key, label, min, max] of [
      ["size", "Tamaño", 0.2, 3.5], ["glowIntensity", "Brillo del halo", 0, 4], ["glowSize", "Extensión del halo", 0.2, 4]
    ] as const) {
      const input = document.createElement("input");
      input.type = "range"; input.min = String(min); input.max = String(max); input.step = "0.05";
      input.setAttribute("aria-label", label);
      input.style.cssText = "width:100%;min-width:0;margin:0;";
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;";
      if (key === "glowSize") wrap.style.gridColumn = "1 / -1";
      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;gap:8px;color:#ddd;";
      const value = document.createElement("span");
      value.style.cssText = "color:#fbbf24;font-family:monospace;white-space:nowrap;";
      header.append(document.createTextNode(label), value);
      wrap.append(header, input); grid.append(wrap);
      input.oninput = () => this.updatePoint({ [key]: Number(input.value) });
      this.sliders.set(key, { input, value });
    }
    this.element.append(grid);
    this.refresh();
  }

  get timeline() { return normalizeSolarVisualTimeline(this.host.getConfig()); }
  get selectedId() { return this.selected[this.body]; }

  refresh() {
    const points = this.timeline[this.body];
    let point = points.find(p => p.id === this.selectedId);
    if (!point) {
      const config = this.host.getConfig();
      let hour = Number(config.timeOfDay ?? 12);
      const position = calculateSolarCyclePosition(config, hour);
      const { solarPathSunriseTime: start, solarPathSunsetTime: end } = position.settings;
      if (this.body === "moon" && position.isDay) hour = (end + (24 - end + start) / 2) % 24;
      if (this.body === "sun" && !position.isDay) hour = (start + end) / 2;
      const distance = (time: number) => Math.min(Math.abs(time - hour), 24 - Math.abs(time - hour));
      point = points.reduce((best, p) => distance(p.time) < distance(best.time) ? p : best);
      this.selected[this.body] = point.id;
    }
    const optionsKey = JSON.stringify(points.map(p => [p.id, p.time]));
    if (optionsKey !== this.optionsKey) {
      this.pointSelect.replaceChildren(...points.map((p, i) => new Option(`${i + 1} · ${formatSolarPointTime(p.time)}`, p.id)));
      this.optionsKey = optionsKey;
    }
    this.pointSelect.value = point.id;
    if (document.activeElement !== this.timeInput) this.timeInput.value = formatSolarPointTime(point.time);
    if (document.activeElement !== this.colorInput) this.colorInput.value = point.color;
    this.sliders.forEach(({ input, value }, key) => {
      input.value = String(point![key as "size" | "glowIntensity" | "glowSize"]);
      value.textContent = `${Number(input.value).toFixed(2)}x`;
    });
    this.bodyButtons.forEach((button, body) => {
      button.setAttribute("aria-pressed", String(body === this.body));
      button.style.borderColor = body === this.body ? "#fbbf24" : "#555";
    });
    this.deleteButton.disabled = points.length <= 1;
    this.deleteButton.style.opacity = this.deleteButton.disabled ? "0.4" : "1";
    this.addButton.disabled = points.length >= 1440;
  }

  selectPoint(id: string) {
    const point = this.timeline[this.body].find(p => p.id === id);
    if (!point) return;
    this.selected[this.body] = id;
    this.timeInput.setCustomValidity("");
    this.host.update({ timeOfDay: point.time, enableDayNightCycle: false, isCycleSimulating: false });
    this.host.refresh();
  }

  updatePoint(patch: Partial<SolarVisualPoint>) {
    const timeline = this.timeline;
    const point = timeline[this.body].find(p => p.id === this.selectedId);
    if (!point) return false;
    if (patch.time !== undefined) {
      patch.time = solarPointTime(patch.time);
      if (timeline[this.body].some(p => p.id !== point.id && p.time === patch.time)) return false;
    }
    Object.assign(point, patch);
    this.timeInput.setCustomValidity("");
    this.commit(timeline, point.time);
    return true;
  }

  addPoint(time = Number(this.host.getConfig().timeOfDay ?? 12)) {
    const timeline = this.timeline;
    const points = timeline[this.body];
    if (points.length >= 1440) return;
    time = solarPointTime(time);
    const existing = points.findIndex(p => p.time === time);
    if (existing >= 0) {
      const next = points[(existing + 1) % points.length];
      const gap = ((next.time - time + 24) % 24) || 24;
      time = solarPointTime(time + gap / 2);
    }
    while (points.some(p => p.time === time)) time = solarPointTime(time + 1 / 60);
    const point = { ...sampleSolarVisualPoints(points, time), id: crypto.randomUUID(), time };
    points.push(point);
    this.selected[this.body] = point.id;
    this.commit(timeline, time);
  }

  private deletePoint() {
    const timeline = this.timeline;
    if (timeline[this.body].length <= 1) return;
    timeline[this.body] = timeline[this.body].filter(p => p.id !== this.selectedId);
    const point = timeline[this.body][0];
    this.selected[this.body] = point.id;
    this.commit(timeline, point.time);
  }

  private commit(timeline: SolarVisualTimeline, time: number) {
    this.host.update({ solarVisualTimeline: timeline, timeOfDay: time, enableDayNightCycle: false, isCycleSimulating: false });
    this.host.refresh();
  }
}
