/**
 * SectionedItemEditor
 * 
 * Componente escalable y reutilizable para dividir editores de objetos en secciones
 * lógicas mediante una barra de navegación con iconos (estilo Blender / Unreal / Modern Web).
 * 
 * Reglas de diseño:
 * - Los botones de la barra de navegación muestran ÚNICAMENTE iconos (sin texto).
 * - El título y subtítulo de la sección se muestran en el encabezado del panel activo al seleccionar esa sección.
 * - Diseño Dark Mode con acentos cyan/azul neón, micro-animaciones y glassmorphism.
 */

export interface EditorSectionDef {
  id: string;
  number?: number;
  title: string;
  subtitle: string;
  iconSvg: string;
  tooltip?: string;
  badge?: string;
  content: HTMLElement;
  onSelect?: () => void;
}

export class SectionedItemEditor {
  private container: HTMLElement;
  private railContainer: HTMLElement;
  private contentContainer: HTMLElement;
  private headerTitle: HTMLElement;
  private headerSubtitle: HTMLElement;
  private headerIconBadge: HTMLElement;
  private bodyContainer: HTMLElement;
  
  private sections: EditorSectionDef[] = [];
  private activeSectionId: string | null = null;
  private navButtons: Map<string, HTMLButtonElement> = new Map();

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'sectioned-item-editor';
    this.container.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: 12px;
      width: 100%;
      min-height: 440px;
      height: 100%;
      box-sizing: border-box;
      position: relative;
    `;

    // Left Navigation Rail (Icon-Only buttons)
    this.railContainer = document.createElement('nav');
    this.railContainer.className = 'sectioned-editor-rail';
    this.railContainer.setAttribute('aria-label', 'Secciones de configuración');
    this.railContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 44px;
      flex-shrink: 0;
      background: rgba(18, 18, 24, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 6px 3px;
      box-sizing: border-box;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      align-items: center;
      height: fit-content;
      max-height: 100%;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;

    // Right Content Pane (Renders directly into panel space without boxed card container)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'sectioned-editor-content';
    this.contentContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0;
      box-sizing: border-box;
      box-shadow: none;
      backdrop-filter: none;
    `;

    // Header Area
    const headerWrapper = document.createElement('div');
    headerWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
      width: 100%;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    `;

    this.headerIconBadge = document.createElement('span');
    this.headerIconBadge.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: rgba(0, 240, 255, 0.12);
      color: #00f0ff;
      border: 1px solid rgba(0, 240, 255, 0.25);
      flex-shrink: 0;
    `;

    this.headerTitle = document.createElement('h4');
    this.headerTitle.style.cssText = `
      margin: 0;
      font-size: 13.5px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: 0.2px;
    `;

    titleRow.append(this.headerIconBadge, this.headerTitle);

    this.headerSubtitle = document.createElement('p');
    this.headerSubtitle.style.cssText = `
      margin: 0;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.35;
      padding-left: 32px;
    `;

    headerWrapper.append(titleRow, this.headerSubtitle);

    // Body Area (seamlessly blends into the panel)
    this.bodyContainer = document.createElement('div');
    this.bodyContainer.className = 'sectioned-editor-body';
    this.bodyContainer.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    this.contentContainer.append(headerWrapper, this.bodyContainer);
    this.container.append(this.railContainer, this.contentContainer);

    if (typeof document !== 'undefined' && !document.getElementById('sectioned-item-editor-style')) {
      const style = document.createElement('style');
      style.id = 'sectioned-item-editor-style';
      style.textContent = `
        .sectioned-editor-rail::-webkit-scrollbar,
        .construction-section-rail-wrapper::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        @keyframes sectionFadeIn {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public getRailElement(): HTMLElement {
    return this.railContainer;
  }

  public getContentElement(): HTMLElement {
    return this.contentContainer;
  }

  public setDetached(detached: boolean) {
    if (detached) {
      if (this.railContainer.parentElement === this.container) {
        this.container.removeChild(this.railContainer);
      }
      this.container.style.display = 'contents';
      this.contentContainer.style.width = '100%';
    } else {
      if (this.railContainer.parentElement !== this.container) {
        this.container.insertBefore(this.railContainer, this.contentContainer);
      }
      this.container.style.display = 'flex';
      this.contentContainer.style.width = '';
    }
  }

  public setSections(sections: EditorSectionDef[], defaultSectionId?: string) {
    this.sections = sections;
    this.railContainer.innerHTML = '';
    this.bodyContainer.innerHTML = '';
    this.navButtons.clear();

    sections.forEach((sec, index) => {
      // 1. Navigation Button (Icon Only!)
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `section-rail-btn section-btn-${sec.id}`;
      btn.setAttribute('data-id', sec.id);
      const titleText = sec.number ? `${sec.number}. ${sec.title}` : sec.title;
      btn.setAttribute('title', `${titleText} — ${sec.subtitle}`);
      btn.setAttribute('aria-label', titleText);

      btn.style.cssText = `
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        cursor: pointer;
        transition: all 0.18s ease;
        padding: 0;
        outline: none;
        user-select: none;
        flex-shrink: 0;
      `;

      btn.innerHTML = sec.iconSvg;
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.style.width = '18px';
        svg.style.height = '18px';
        svg.style.display = 'block';
        svg.style.pointerEvents = 'none';
      }

      // Indicator bar for active state
      const indicator = document.createElement('div');
      indicator.className = 'rail-active-indicator';
      indicator.style.cssText = `
        position: absolute;
        right: -2px;
        top: 6px;
        bottom: 6px;
        width: 3px;
        border-radius: 2px;
        background: #00f0ff;
        opacity: 0;
        transition: opacity 0.18s ease;
        box-shadow: 0 0 6px #00f0ff;
      `;
      btn.appendChild(indicator);

      // Hover effects
      btn.onmouseenter = () => {
        if (this.activeSectionId !== sec.id) {
          btn.style.background = 'rgba(255, 255, 255, 0.1)';
          btn.style.color = '#ffffff';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          btn.style.transform = 'translateY(-1px) scale(1.04)';
        }
      };

      btn.onmouseleave = () => {
        if (this.activeSectionId !== sec.id) {
          btn.style.background = 'rgba(255, 255, 255, 0.04)';
          btn.style.color = '#94a3b8';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          btn.style.transform = 'none';
        }
      };

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectSection(sec.id);
      };

      this.railContainer.appendChild(btn);
      this.navButtons.set(sec.id, btn);

      // 2. Section Content Container
      sec.content.style.display = 'none';
      sec.content.style.width = '100%';
      sec.content.style.boxSizing = 'border-box';
      this.bodyContainer.appendChild(sec.content);
    });

    const targetId = defaultSectionId || (sections.length > 0 ? sections[0].id : null);
    if (targetId) {
      this.selectSection(targetId);
    }
  }

  public selectSection(id: string) {
    const targetSection = this.sections.find(s => s.id === id);
    if (!targetSection) return;

    this.activeSectionId = id;

    // Update buttons
    this.navButtons.forEach((btn, secId) => {
      const indicator = btn.querySelector('.rail-active-indicator') as HTMLElement;
      if (secId === id) {
        btn.classList.add('active');
        btn.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(59, 130, 246, 0.15))';
        btn.style.borderColor = 'rgba(0, 240, 255, 0.55)';
        btn.style.color = '#00f0ff';
        btn.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.3)';
        btn.style.transform = 'none';
        if (indicator) indicator.style.opacity = '1';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255, 255, 255, 0.04)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        btn.style.color = '#94a3b8';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'none';
        if (indicator) indicator.style.opacity = '0';
      }
    });

    // Update Header
    const titleText = targetSection.number ? `${targetSection.number}. ${targetSection.title}` : targetSection.title;
    this.headerTitle.textContent = titleText;
    this.headerSubtitle.textContent = targetSection.subtitle;
    this.headerIconBadge.innerHTML = targetSection.iconSvg;
    const badgeSvg = this.headerIconBadge.querySelector('svg');
    if (badgeSvg) {
      badgeSvg.style.width = '15px';
      badgeSvg.style.height = '15px';
    }

    // Toggle content visibility with subtle transition
    this.sections.forEach(sec => {
      if (sec.id === id) {
        sec.content.style.display = 'flex';
        sec.content.style.flexDirection = 'column';
        sec.content.style.gap = '8px';
        sec.content.style.animation = 'sectionFadeIn 0.18s ease-out';
        if (sec.onSelect) sec.onSelect();
      } else {
        sec.content.style.display = 'none';
      }
    });
  }

  public getActiveSectionId(): string | null {
    return this.activeSectionId;
  }
}

/**
 * Standard Modern SVG Icons matching the user's reference image
 */
export const SECTION_ICONS = {
  // 1. Apariencia y texturas (Palette)
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="13.5" cy="6.5" r=".7" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".7" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".7" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".7" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>`,

  // 2. Dimensiones y geometría (Coordinate arrows & bounding bounds)
  dimensions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 14 4 4 14 4"/>
    <line x1="4" y1="4" x2="11" y2="11"/>
    <polyline points="20 10 20 20 10 20"/>
    <line x1="20" y1="20" x2="13" y2="13"/>
  </svg>`,

  // 3. Conducción y rendimiento (Speedometer)
  speedometer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 14l3.5-3.5"/>
    <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
    <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
  </svg>`,

  // 4. Asientos y controles (Users / Occupants)
  seats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,

  // 5. Física, gravedad y estabilidad (Wind / Flow streamlines)
  physics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2"/>
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
  </svg>`,

  // 6. Durabilidad y daños (Shield alert)
  durability: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <circle cx="12" cy="16" r=".5" fill="currentColor"/>
  </svg>`,

  // 7. Jetpack y combustible (Lightning zap)
  jetpack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>`,

  // 8. Efectos visuales y velocidad (Sparkles)
  effects: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
    <path d="M5 3v4"/>
    <path d="M3 5h4"/>
  </svg>`,

  // 9. Puntaje y acrobacias (Trophy)
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>
    <path d="M6 4h12v7a6 6 0 0 1-12 0V4z"/>
  </svg>`
};
