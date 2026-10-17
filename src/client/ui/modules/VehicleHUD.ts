import { animate } from 'animejs';
import type { HUDConfig } from '../../types';
import { fitLength } from './HUDResponsiveUtils';

export const VEHICLE_HUD_ITEMS = [
  { id: 'vehicleSpeed', label: 'Moto · Velocímetro', width: 260, height: 260, pos: { right: '112px', bottom: '110px' } },
  { id: 'vehicleFuel', label: 'Moto · Combustible', width: 74, height: 226, pos: { right: '28px', bottom: '117px' } },
  { id: 'vehicleDurability', label: 'Moto · Durabilidad', width: 326, height: 68, pos: { right: '28px', bottom: '36px' } },
  { id: 'vehicleStunts', label: 'Moto · Medidor de Puntajes', width: 280, height: 110, pos: { left: '50%', top: '15%', transform: 'translateX(-50%)' } },
] as const;
export type VehicleHUDId = typeof VEHICLE_HUD_ITEMS[number]['id'];
export interface VehicleHUDData {
  speed: number; maxSpeed: number; fuel: number; maxFuel: number;
  durability: number; maxDurability: number; durabilityEnabled: boolean; jetpack: boolean;
}
export const VEHICLE_HUD_PREVIEW: VehicleHUDData = { speed: 104, maxSpeed: 240, fuel: 38, maxFuel: 60, durability: 76, maxDurability: 100, durabilityEnabled: true, jetpack: false };
export function vehicleShowKey(id: string) { return `show${id[0].toUpperCase()}${id.slice(1)}`; }
export function isVehicleHUDId(id: string): id is VehicleHUDId { return VEHICLE_HUD_ITEMS.some(item => item.id === id); }
export function ensureVehicleHUDDefaults(settings: HUDConfig) {
  const s = settings as any;
  s.layerOrder ??= ['health', 'jump', 'stamina', 'inventory'];
  for (const item of VEHICLE_HUD_ITEMS) {
    s[vehicleShowKey(item.id)] ??= true;
    s[item.id + 'Pos'] ??= { ...item.pos };
    s[item.id + 'Width'] ??= item.width;
    s[item.id + 'Height'] ??= item.height;
    s[item.id + 'ShowText'] ??= true;
    if (!s.layerOrder.includes(item.id)) s.layerOrder.push(item.id);
  }
  s.vehicleStuntsShowTotal ??= false;
}
let nextId = 0;
const point = (angle: number, radius: number) => `${128 + Math.sin(angle * Math.PI / 180) * radius},${128 - Math.cos(angle * Math.PI / 180) * radius}`;

/** A shared SVG design keeps role editor previews identical to the live instruments. */
export class VehicleHUDWidget {
  readonly element = document.createElement('div');
  private inner = document.createElement('div');
  private values = { value: 0 };
  private target = NaN;
  private transition?: ReturnType<typeof animate>;
  private entrance?: ReturnType<typeof animate>;
  private shown = false;
  private data = VEHICLE_HUD_PREVIEW;
  constructor(readonly id: VehicleHUDId, settings: HUDConfig, container: HTMLElement) {
    const s = settings as any;
    const item = VEHICLE_HUD_ITEMS.find(item => item.id === id)!;
    const uid = `moto-gauge-${nextId++}`;
    this.element.id = `hud-${id}`;
    this.element.dataset.hudId = id;
    this.element.style.cssText = 'position:absolute;pointer-events:none;visibility:hidden;';
    this.inner.style.cssText = `width:${fitLength(s[id + 'Width'] ?? item.width, container, 'x', 32)}px;height:${fitLength(s[id + 'Height'] ?? item.height, container, 'y', 24)}px;filter:drop-shadow(0 5px 12px #0009);`;
    this.element.appendChild(this.inner);
    const defs = `<defs>
      <radialGradient id="${uid}-face"><stop stop-color="#202741"/><stop offset="1" stop-color="#101627" stop-opacity=".95"/></radialGradient>
      <linearGradient id="${uid}-rim" x2=".9" y2="1"><stop stop-color="#baf9ff"/><stop offset=".48" stop-color="#70d8f5"/><stop offset="1" stop-color="#9d86eb"/></linearGradient>
      <linearGradient id="${uid}-fuel" x2="0" y2="1"><stop stop-color="#e6ff90"/><stop offset=".55" stop-color="#75eca0"/><stop offset="1" stop-color="#39d5c5"/></linearGradient>
      <linearGradient id="${uid}-life"><stop stop-color="#f5ff8e"/><stop offset=".5" stop-color="#ffc85b"/><stop offset="1" stop-color="#ff805f"/></linearGradient>
      <filter id="${uid}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>`;
    const font = 'font-family="system-ui, sans-serif"';
    if (id === 'vehicleSpeed') {
      const ticks = Array.from({ length: 25 }, (_, i) => {
        const angle = -135 + i * 270 / 24;
        return `<line x1="${point(angle, i % 2 ? 104 : 98).split(',')[0]}" y1="${point(angle, i % 2 ? 104 : 98).split(',')[1]}" x2="${point(angle, 111).split(',')[0]}" y2="${point(angle, 111).split(',')[1]}" stroke="#c5ecff" stroke-opacity="${i % 2 ? '.4' : '.9'}" stroke-width="${i % 2 ? 1 : 2}"/>`;
      }).join('');
      const labels = Array.from({ length: 13 }, (_, i) => `<text data-tick="${i}" x="${point(-135 + i * 22.5, 85).split(',')[0]}" y="${Number(point(-135 + i * 22.5, 85).split(',')[1]) + 4}" text-anchor="middle" fill="#cbd7eb" font-size="11" font-weight="700">${i * 20}</text>`).join('');
      this.inner.innerHTML = `<svg viewBox="0 0 256 256" width="100%" height="100%" ${font}>
        ${defs}<circle cx="128" cy="128" r="123" fill="url(#${uid}-face)" stroke="url(#${uid}-rim)" stroke-width="2"/>
        <path d="M ${point(-135, 115)} A 115 115 0 1 1 ${point(135, 115)}" fill="none" stroke="url(#${uid}-rim)" stroke-width="7"/>
        ${ticks}${labels}<text x="128" y="95" fill="#8997b4" font-size="7" letter-spacing="3" text-anchor="middle">MOTORBIKE</text>
        <g data-needle transform="rotate(-135 128 128)"><path d="M124 143 L127 34 L132 143 Z" fill="#ffa840" filter="url(#${uid}-glow)"/><path d="M125 140 L128 35 L131 140 Z" fill="#ffb354"/></g>
        <circle cx="128" cy="128" r="6" fill="#ffb354"/>
        <text data-value x="127" y="202" fill="#f5f6ff" font-size="45" font-weight="900" font-style="italic" text-anchor="middle">0</text>
        <text x="128" y="219" fill="#beddf6" font-size="10" letter-spacing="2" text-anchor="middle">km/h</text>
        <text data-status x="128" y="238" fill="#70e9ce" font-size="7" letter-spacing="1.5" text-anchor="middle">EN MARCHA</text>
      </svg>`;
    } else if (id === 'vehicleFuel') {
      this.inner.innerHTML = `<svg viewBox="0 0 74 226" width="100%" height="100%" ${font}>${defs}
        <text x="37" y="13" text-anchor="middle" fill="#e9fcf3" font-size="7.5" font-weight="800" letter-spacing=".3">COMBUSTIBLE</text>
        <path d="M22 43 V25 H37 V43 M19 44 H40 M25 28 H34 V34 H25 Z M37 29 L43 35 V42 Q47 46 47 40 V31 L42 26" fill="none" stroke="#85f9b6" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="17" y="53" width="29" height="149" rx="4" fill="#111d29" stroke="#74e9c7" stroke-width="2"/>
        <rect x="20" y="56" width="23" height="143" rx="2" fill="#39d5c5" opacity=".12"/>
        <g data-fill transform="translate(0 199) scale(1 1) translate(0 -199)"><rect x="20" y="56" width="23" height="143" rx="2" fill="url(#${uid}-fuel)"/></g>
        <text x="53" y="62" fill="#c8eee4" font-size="11" font-style="italic">F</text><text x="53" y="201" fill="#c8eee4" font-size="11" font-style="italic">E</text>
        <text data-value x="33" y="218" text-anchor="middle" fill="#b1ffd8" font-size="11" font-weight="700">100%</text>
      </svg>`;
    } else if (id === 'vehicleDurability') {
      this.inner.innerHTML = `<svg viewBox="0 0 326 68" width="100%" height="100%" ${font}>${defs}
        <text x="32" y="13" fill="#fff0cc" font-size="9" font-weight="800" letter-spacing="1">DURABILIDAD</text>
        <path d="M6 28 L21 43 M6 43 L21 28 M4 24 L5 31 L10 33 L13 30 L11 24 M18 39 L17 44 L22 47 L25 43 Z" fill="none" stroke="#ffd069" stroke-width="3" stroke-linecap="round"/>
        <rect x="32" y="23" width="290" height="25" rx="4" fill="#101b2c" stroke="#eeb77c" stroke-width="1.5"/>
        <g data-fill transform="translate(35 0) scale(1 1) translate(-35 0)"><rect x="35" y="26" width="284" height="19" rx="2" fill="url(#${uid}-life)"/></g>
        <text data-value x="178" y="40" fill="#182139" font-size="10" font-weight="800" text-anchor="middle">100 / 100</text>
        <text data-status x="32" y="63" fill="#d4cab6" font-size="8" letter-spacing="1">ESTADO ÓPTIMO</text>
        <text x="321" y="63" fill="#d4cab6" font-size="8" text-anchor="end">MAX</text>
      </svg>`;
    } else {
      const showDetails = s.vehicleStuntsShowText !== false;
      const showTotal = s.vehicleStuntsShowTotal === true;
      this.inner.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;height:100%;pointer-events:none;justify-content:center;font-family:system-ui,sans-serif;background:rgba(15,23,42,0.85);border:1px solid rgba(0,240,255,0.45);border-radius:12px;padding:6px 10px;box-sizing:border-box;backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,0.5);">
          ${showDetails ? `
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="background:rgba(15,23,42,0.85);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;">⏱️ 1.8s AIRE</span>
            <span style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:800;">🔥 x1.5 COMBO</span>
          </div>` : ''}
          <div data-value style="font-size:24px;font-weight:900;color:#00f0ff;text-shadow:0 0 16px rgba(0,240,255,0.8);line-height:1.1;">+450 PTS</div>
          <div style="background:rgba(16,185,129,0.25);border:1px solid #34d399;color:#6ee7b7;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;">✨ +150 Aterrizaje perfecto</div>
          ${showTotal ? `<div style="font-size:10px;color:#cbd5e1;font-weight:600;margin-top:2px;">🏆 Total acumulado: 1,789</div>` : ''}
        </div>
      `;
    }
    if (s[id + 'ShowText'] === false) this.inner.querySelector('[data-value]')?.setAttribute('visibility', 'hidden');
  }

  update(data: VehicleHUDData, smooth = true) {
    this.data = data;
    const next = this.id === 'vehicleSpeed' ? Math.round(Math.abs(data.speed))
      : this.id === 'vehicleFuel' ? Math.round(Math.max(0, Math.min(1, data.fuel / Math.max(1, data.maxFuel))) * 100)
      : this.id === 'vehicleDurability' ? (data.durabilityEnabled ? Math.round(Math.max(0, Math.min(1, data.durability / Math.max(1, data.maxDurability))) * 100) : 100)
      : 450;
    if (next !== this.target) {
      this.target = next;
      this.transition?.pause();
      if (smooth && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        this.transition = animate(this.values, { value: next, duration: 170, ease: 'outQuad', onUpdate: () => this.paint() });
      } else this.values.value = next;
    }
    this.paint();
  }
  private paint() {
    const data = this.data, value = this.values.value;
    const text = this.inner.querySelector('[data-value]')!;
    const broken = data.durabilityEnabled && data.durability <= 0;
    if (this.id === 'vehicleSpeed') {
      const limit = Math.max(240, Math.ceil(data.maxSpeed / 40) * 40);
      this.inner.querySelector('[data-needle]')!.setAttribute('transform', `rotate(${-135 + Math.min(value / limit, 1) * 270} 128 128)`);
      this.inner.querySelectorAll('[data-tick]').forEach((el, i) => { el.textContent = String(Math.round(i * limit / 12)); });
      text.textContent = String(Math.round(value));
      this.inner.querySelector('[data-status]')!.textContent = broken ? 'AVERIADA' : data.jetpack ? 'JETPACK ACTIVO' : value < 1 ? 'EN REPOSO' : 'EN MARCHA';
    } else if (this.id === 'vehicleFuel') {
      this.inner.querySelector('[data-fill]')!.setAttribute('transform', `translate(0 199) scale(1 ${value / 100}) translate(0 -199)`);
      text.textContent = `${Math.round(value)}%`;
      text.setAttribute('fill', value <= 20 ? '#ff986f' : '#b1ffd8');
    } else if (this.id === 'vehicleDurability') {
      this.inner.querySelector('[data-fill]')!.setAttribute('transform', `translate(35 0) scale(${value / 100} 1) translate(-35 0)`);
      text.textContent = data.durabilityEnabled ? `${Math.ceil(data.durability)} / ${data.maxDurability}` : '∞';
      text.setAttribute('fill', value < 50 ? '#ffffff' : '#182139');
      this.inner.querySelector('[data-status]')!.textContent = !data.durabilityEnabled ? 'SIN DESGASTE' : broken ? 'AVERIADA' : value <= 25 ? 'ESTADO CRÍTICO' : value <= 60 ? 'DAÑADA' : 'ESTADO ÓPTIMO';
    } else {
      if (text) text.textContent = '+450 PTS';
    }
    this.element.setAttribute('aria-label', this.id === 'vehicleSpeed' ? `${Math.round(value)} kilómetros por hora` : this.id === 'vehicleStunts' ? 'Medidor de Acrobacias y Puntaje' : `${this.id === 'vehicleFuel' ? 'Combustible' : 'Durabilidad'}: ${text?.textContent || ''}`);
  }
  show(visible: boolean, animated = true) {
    if (visible === this.shown) return;
    this.shown = visible;
    this.element.style.visibility = visible ? 'visible' : 'hidden';
    this.entrance?.pause();
    if (visible && animated && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.entrance = animate(this.inner, { opacity: [0, 1], translateY: [12, 0], scale: [0.94, 1], duration: 420, ease: 'outExpo' });
    } else { this.inner.style.opacity = '1'; this.inner.style.transform = 'none'; }
    if (!visible) { this.transition?.pause(); this.target = NaN; }
  }
  destroy() { this.transition?.pause(); this.entrance?.pause(); this.element.remove(); }
}
