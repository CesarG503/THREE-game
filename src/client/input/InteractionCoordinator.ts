import * as THREE from 'three';

/** One owner per gesture. Panels never restore pointer lock; only canvas gestures do. */
export function isTextInput(target: any): boolean {
  return !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
}

export type EditorTool = 'build' | 'edit';

export class InteractionCoordinator {
  private abort = new AbortController();
  private gesture: { owner: string; cancel: () => void } | null = null;
  private handledEvents = new WeakSet<Event>();
  private suspended = false;
  private suppressClick = false;
  public rightClickDragThreshold = 6;

  constructor(private game: any) {
    const options = { capture: true, signal: this.abort.signal };
    window.addEventListener('keydown', this.onKeyDown, options);
    window.addEventListener('blur', this.onBlur, options);
    window.addEventListener('focus', () => { this.suspended = false; this.sync(); }, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onBlur();
    }, options);
    document.addEventListener('gamePauseChanged', () => this.sync(), options);
    document.addEventListener('focusin', () => this.sync(), options);
    document.addEventListener('focusout', () => queueMicrotask(() => {
      if (!this.abort.signal.aborted) this.sync();
    }), options);
    window.addEventListener('click', (event) => {
      if (this.suppressClick && event.target === this.game?.sceneManager?.renderer?.domElement) {
        this.suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, options);
    window.addEventListener('pointerdown', () => {
      this.suppressClick = false;
      if (this.suspended) { this.suspended = false; this.sync(); }
    }, options);
    window.addEventListener('mousedown', () => {
      this.suppressClick = false;
      if (this.suspended) { this.suspended = false; this.sync(); }
    }, options);
  }

  get activeTool(): EditorTool {
    return this.game.inventoryManager?.getCurrentItem?.() ? 'build' : 'edit';
  }

  isGizmoInteracting(event?: MouseEvent | PointerEvent): boolean {
    const gizmo = this.game.objectInspector?.transformGizmo;
    if (!gizmo) return false;
    if (typeof gizmo.isInteracting === 'function' && gizmo.isInteracting()) return true;
    if (event && typeof gizmo.isPointerOverGizmo === 'function') {
      const domElement = this.game.sceneManager?.renderer?.domElement;
      if (domElement) {
        const rect = domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        return gizmo.isPointerOverGizmo(mouse);
      }
    }
    return false;
  }

  isConnectorInteracting(event?: MouseEvent | PointerEvent): boolean {
    const groupManager = this.game.editorGroupManager;
    if (!groupManager) return false;
    if (typeof groupManager.isConnectorDragging === 'function' && groupManager.isConnectorDragging()) return true;
    if (event && typeof groupManager.isPointerOverConnector === 'function') {
      return groupManager.isPointerOverConnector(event);
    }
    return false;
  }

  private get overlay() {
    const panel = this.game.constructionMenu?.advancedWeaponConfigPanel;
    return panel?.container?.style.display === 'flex' ? panel : null;
  }

  private get menuOpen() {
    const menu = this.game.constructionMenu;
    return menu?.isVisible && menu.container?.style.display !== 'none';
  }

  get state(): string {
    if (this.suspended) return 'suspended';
    if (this.gesture) return this.gesture.owner;
    if (isTextInput(document.activeElement)) return 'text';
    if (this.overlay) return 'overlay';
    if (this.game.cameraController?.isPaused) return 'paused';
    if (this.menuOpen) return 'menu';
    if (this.game.isAnyEditorUIOpen()) return 'editor';
    return 'gameplay';
  }

  markHandled(event: Event) { this.handledEvents.add(event); }
  isHandled(event: Event) { return this.handledEvents.has(event); }

  get blocksMovement(): boolean {
    return ['text', 'menu', 'overlay', 'paused', 'suspended'].includes(this.state);
  }

  get blocksGameplayActions(): boolean {
    return this.state !== 'gameplay';
  }

  get blocksGameplay(): boolean {
    return this.blocksGameplayActions;
  }

  get blocksScene(): boolean {
    return ['text', 'menu', 'overlay', 'paused', 'suspended'].includes(this.state);
  }

  /**
   * Permite colocar objetos en la escena si hay un objeto equipado en la ranura activa,
   * no hay un gesto exclusivo activo, no se está interactuando con gizmo o conector,
   * ni escribiendo en inputs de texto o interactuando con modales.
   * El Inspector y el Explorer pueden permanecer abiertos sin impedir la construcción.
   */
  get canBuild(): boolean {
    if (this.game.gameMode !== 'editor') return false;
    if (this.gesture) return false;
    if (isTextInput(document.activeElement)) return false;
    if (this.overlay || this.menuOpen || this.game.cameraController?.isPaused || this.suspended) return false;
    if (this.isGizmoInteracting() || this.isConnectorInteracting()) return false;
    const currentItem = this.game.inventoryManager?.getCurrentItem?.();
    if (!currentItem) return false;
    return true;
  }

  /**
   * Permite interactuar con herramientas de edición (gizmos, conectores, inspector)
   * fuera de campos de texto, modales o gestos bloqueantes.
   */
  get canEdit(): boolean {
    if (this.game.gameMode !== 'editor') return false;
    if (isTextInput(document.activeElement)) return false;
    if (this.overlay || this.menuOpen || this.game.cameraController?.isPaused || this.suspended) return false;
    return true;
  }

  begin(owner: string, cancel: () => void): boolean {
    if (this.gesture) return false;
    this.suspended = false;
    if (isTextInput(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    if (this.blocksScene && owner !== 'tree-drag') return false;
    this.gesture = { owner, cancel };
    this.sync();
    return true;
  }

  end(owner: string) {
    if (this.gesture?.owner !== owner) return;
    this.gesture = null;
    this.suppressClick = true;
    this.sync();
  }

  cancelGesture() {
    const gesture = this.gesture;
    this.gesture = null;
    gesture?.cancel();
    if (gesture) this.suppressClick = true;
    this.sync();
  }

  public handleEscapeKey(event?: any): void {
    if (this.gesture) this.cancelGesture();
    else if (this.overlay) this.overlay.hide();
    else if (this.menuOpen) this.game.constructionMenu.toggle();
    else if (this.game.constructionMenu?.logicSystem?.isEditingMap) this.game.constructionMenu.logicSystem.endMapEdit();
    else if (this.game.editorSelection?.getCount() > 0) this.game.editorSelection.clear();
    else if (this.game.objectInspector?.isVisible) this.game.objectInspector.hide();
    else if (this.game.editorExplorer?.isVisible) this.game.editorExplorer.hide();
    else if (this.game.editorGroupManager?.isCouplingMode()) this.game.editorGroupManager.setCouplingMode(false);
    else this.game.cameraController?.togglePause();
    if (event) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    }
    this.sync();
  }

  sync() {
    if (this.blocksMovement) {
      if (typeof this.game.inputManager?.resetMovement === 'function') {
        this.game.inputManager.resetMovement();
      } else {
        this.game.inputManager?.reset();
      }
    }
    if (this.blocksGameplayActions) {
      if (this.game.inputManager?.keys) {
        this.game.inputManager.keys.attack = false;
        this.game.inputManager.keys.aim = false;
      }
      this.game.isMouseDown = false;
      this.game.isFKeyDown = false;
      this.game.fKeyHeldTime = 0;
      this.game.fuelZoneSystem?.interaction.release();
    }
    this.game.cameraController?.setUIOpen(this.blocksGameplayActions);
    // Menus suppress tools without detaching the selected object.
    const isEditingMap = !!this.game.constructionMenu?.logicSystem?.isEditingMap;
    const canUseGizmo = !this.blocksScene && !isEditingMap;
    const controls = this.game.objectInspector?.transformGizmo?.controls;
    if (controls && !this.gesture) controls.enabled = canUseGizmo;
    const helper = this.game.objectInspector?.transformGizmo?.helper;
    if (helper && this.game.gameMode === 'editor') {
      helper.visible = canUseGizmo && !!this.game.objectInspector?.transformGizmo?.target;
    }
    const waypointControls = this.game.constructionMenu?.logicSystem?.waypointGizmo?.controls;
    if (waypointControls && !this.gesture) waypointControls.enabled = !this.blocksScene;
  }

  private onBlur = () => {
    if (this.gesture?.owner === 'tree-drag') return;
    this.suspended = true;
    this.cancelGesture();
    this.game.inputManager?.reset();
    this.game.isMouseDown = false;
    this.game.isFKeyDown = false;
    this.game.fKeyHeldTime = 0;
    this.game.fuelZoneSystem?.interaction.release();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const consume = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (isTextInput(event.target) || isTextInput(document.activeElement)) {
      if (key === 'escape') { (document.activeElement as HTMLElement)?.blur(); consume(); }
      return;
    }
    if (key === 'escape') {
      if (event.repeat) { consume(); return; }
      this.handleEscapeKey(event);
      return;
    }
    if (this.game.gameMode === 'editor' && key === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      consume();
      if (event.repeat || this.overlay || this.game.cameraController?.isPaused) return;
      if (this.game.editorExplorer?.toggleCouplingMode) {
        this.game.editorExplorer.toggleCouplingMode();
      } else if (this.game.editorGroupManager) {
        const next = !this.game.editorGroupManager.isCouplingMode();
        this.game.editorGroupManager.setCouplingMode(next);
      }
      return;
    }
    if (this.game.gameMode === 'editor' && (key === 'h' || key === 'e') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      consume();
      if (event.repeat || this.overlay || this.game.cameraController?.isPaused) return;
      this.suspended = false;
      this.cancelGesture();
      if (key === 'h') this.game.editorExplorer?.toggleVisibility();
      else if (this.game.constructionMenu?.logicSystem?.isEditingMap) this.game.constructionMenu.logicSystem.endMapEdit();
      else this.game.constructionMenu?.toggle();
      this.sync();
    }
  };

  dispose() { this.cancelGesture(); this.abort.abort(); }
}
