/** One owner per gesture. Panels never restore pointer lock; only canvas gestures do. */
export function isTextInput(target: any): boolean {
  return !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
}

export class InteractionCoordinator {
  private abort = new AbortController();
  private gesture: { owner: string; cancel: () => void } | null = null;
  private handledEvents = new WeakSet<Event>();
  private suspended = false;
  private suppressClick = false;

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
      if (this.suppressClick && event.target === this.game.sceneManager.renderer.domElement) {
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
      if (this.suspended) { this.suspended = false; this.sync(); }
    }, options);
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

  get blocksGameplay(): boolean { return this.state !== 'gameplay'; }
  get blocksScene(): boolean { return !['gameplay', 'editor'].includes(this.state); }

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

  sync() {
    const blocked = this.blocksGameplay;
    if (blocked) {
      this.game.inputManager?.reset();
      this.game.isMouseDown = false;
      this.game.isFKeyDown = false;
      this.game.fKeyHeldTime = 0;
      this.game.fuelZoneSystem?.interaction.release();
    }
    this.game.cameraController?.setUIOpen(blocked);
    // Menus suppress tools without detaching the selected object.
    const controls = this.game.objectInspector?.transformGizmo?.controls;
    if (controls && !this.gesture) controls.enabled = !this.blocksScene && !this.game.constructionMenu?.logicSystem?.isEditingMap;
    const waypointControls = this.game.constructionMenu?.logicSystem?.waypointGizmo?.controls;
    if (waypointControls && !this.gesture) waypointControls.enabled = !this.blocksScene;
  }

  private onBlur = () => {
    if (this.gesture?.owner === 'tree-drag') return;
    this.suspended = true;
    this.cancelGesture();
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
      if (this.gesture) this.cancelGesture();
      else if (this.overlay) this.overlay.hide();
      else if (this.menuOpen) this.game.constructionMenu.toggle();
      else if (this.game.constructionMenu?.logicSystem?.isEditingMap) this.game.constructionMenu.logicSystem.endMapEdit();
      else if (this.game.objectInspector?.isVisible) this.game.objectInspector.hide();
      else if (this.game.editorExplorer?.isVisible) this.game.editorExplorer.hide();
      else if (this.game.editorGroupManager?.isCouplingMode()) this.game.editorGroupManager.setCouplingMode(false);
      else this.game.cameraController?.togglePause();
      consume();
      this.sync();
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
