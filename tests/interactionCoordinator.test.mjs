import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const { InteractionCoordinator } = await server.ssrLoadModule('/src/client/input/InteractionCoordinator.ts');
function fixture() {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null });
  const game = { gameMode: 'editor', sceneManager: { renderer: { domElement: {} } },
    inputManager: { reset() { game.resets++; } }, resets: 0,
    cameraController: { isPaused: false, setUIOpen(value) { this.isUIOpen = value; }, togglePause() { this.isPaused = !this.isPaused; } },
    editorExplorer: { isVisible: false, toggleVisibility() { this.isVisible = !this.isVisible; }, hide() { this.isVisible = false; } },
    constructionMenu: { isVisible: false, toggle() { this.isVisible = !this.isVisible; } },
    objectInspector: { isVisible: false, hide() { this.isVisible = false; } },
    isAnyEditorUIOpen() { return this.editorExplorer.isVisible || this.constructionMenu.isVisible || this.objectInspector.isVisible; },
  };
  const coordinator = new InteractionCoordinator(game);
  const key = (key, repeat = false) => window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key, repeat }));
  return { game, coordinator, key };
}
test('exclusive gestures and one Escape transition per key; repeats ignored', () => {
  const { game, coordinator: c, key } = fixture();
  key('h'); assert.equal(c.state, 'editor');
  key('h', true); assert.equal(c.state, 'editor');
  let canceled = 0;
  assert.equal(c.begin('gizmo-drag', () => canceled++), true);
  assert.equal(c.begin('connector-drag', () => {}), false);
  key('Escape'); assert.equal(canceled, 1); assert.equal(game.editorExplorer.isVisible, true);
  game.objectInspector.isVisible = true;
  key('e'); assert.equal(c.state, 'menu');
  key('Escape'); assert.equal(game.objectInspector.isVisible, true); assert.equal(game.cameraController.isPaused, false);
  key('Escape'); assert.equal(game.objectInspector.isVisible, false);
  key('Escape'); assert.equal(c.state, 'gameplay');
  c.dispose();
});
test('blur cancels once, resets held input, and disposed listeners cannot reopen panels', () => {
  const { game, coordinator: c, key } = fixture();
  let canceled = 0;
  c.begin('connector-drag', () => canceled++);
  window.dispatchEvent(new Event('blur'));
  assert.equal(canceled, 1); assert.equal(c.state, 'suspended'); assert.equal(c.blocksScene, true);
  assert.ok(game.resets > 0);
  window.dispatchEvent(new Event('focus')); assert.equal(c.state, 'gameplay');
  c.dispose(); key('h'); assert.equal(game.editorExplorer.isVisible, false);
});
test('text focus blocks gameplay and Escape only blurs the field', () => {
  const { game, coordinator: c, key } = fixture();
  game.editorExplorer.isVisible = true;
  document.activeElement = { tagName: 'DIV', isContentEditable: true, blur() { document.activeElement = null; } };
  assert.equal(c.state, 'text'); key('h'); assert.equal(game.editorExplorer.isVisible, true);
  key('Escape'); assert.equal(document.activeElement, null); assert.equal(game.editorExplorer.isVisible, true);
  c.dispose();
});

test('late pointer-lock acquisition is rejected even after the panel has closed', async () => {
  const { coordinator: c } = fixture(); c.dispose();
  const { CameraController } = await server.ssrLoadModule('/src/client/camera/CameraController.ts');
  const THREE = await import('three');
  let requests = 0;
  document.pointerLockElement = null;
  document.exitPointerLock = () => { document.pointerLockElement = null; };
  const canvas = Object.assign(new EventTarget(), { requestPointerLock() { requests++; } });
  const camera = new CameraController(new THREE.PerspectiveCamera(), canvas);
  camera.lock(); camera.lock(); assert.equal(requests, 1);
  camera.setUIOpen(true); camera.setUIOpen(false);
  document.pointerLockElement = canvas;
  document.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(document.pointerLockElement, null);
  camera.lock(); assert.equal(requests, 2);
  camera.dispose(); camera.lock(); assert.equal(requests, 2);
});

test('movement, attack and held keys cannot leak through UI focus or blur', async () => {
  const { coordinator: c } = fixture(); c.dispose();
  const { InputManager } = await server.ssrLoadModule('/src/client/input/InputManager.ts');
  const input = new InputManager();
  input.onKeyDown({ code: 'KeyW', target: { tagName: 'INPUT' } });
  assert.equal(input.keys.forward, false);
  input.uiCheckCallback = () => true;
  input.onKeyDown({ code: 'KeyW' }); assert.equal(input.keys.forward, false);
  input.uiCheckCallback = () => false;
  input.onKeyDown({ code: 'KeyW' }); assert.equal(input.keys.forward, true);
  window.dispatchEvent(new Event('blur')); assert.equal(input.keys.forward, false);
  input.dispose();
});
