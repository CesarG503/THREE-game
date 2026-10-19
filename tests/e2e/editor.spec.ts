import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Full production Game/DOM/Three/Rapier. Only remote services and route bootstrap are isolated.
const html = readFileSync('index.html', 'utf8').replace(/<script[^>]*src="\/src\/client\/main.ts"[^>]*><\/script>/, `<script type="module">
import { Game } from '/src/client/Game.ts';
import { Router } from '/src/client/routing/Router.ts';
const router = new Router(); router.currentRoute = { mode: 'editor', roomId: 'E2E' };
const init = Game.prototype.initGame;
Game.prototype.initGame = function() {
  init.call(this);
  this.sceneManager.renderer.setPixelRatio(0.25);
  this.sceneManager.renderer.shadowMap.enabled = false;
};
window.game = new Game(router);
</script>`);

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.route('**/api/**', route => route.fulfill({ json: { assets: [], prefabs: [], maps: [] } }));
  await page.route('**/editor/E2E', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/editor/E2E', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).game?.interaction && !!(window as any).game?.constructionMenu);
});

const state = (page: any) => page.evaluate(() => {
  const g = (window as any).game;
  return { state: g.interaction.state, h: g.editorExplorer.isVisible, e: g.constructionMenu.isVisible,
    inspector: g.objectInspector.isVisible, locked: !!document.pointerLockElement, paused: g.cameraController.isPaused,
    attack: g.inputManager.keys.attack };
});

test('H/E, Escape priority, input focus, real pointer lock and canvas clicks', async ({ page }) => {
  await page.evaluate(() => { (window as any).game.cameraController.isFirstPerson = true; });
  await page.mouse.click(900, 600);
  await expect.poll(async () => (await state(page)).locked).toBe(true);
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).locked).toBe(false);
  await expect.poll(async () => (await state(page)).h).toBe(true);
  await page.mouse.click(900, 600);
  expect((await state(page)).locked).toBe(false);
  expect((await state(page)).attack).toBe(false);
  await page.keyboard.press('e');
  expect((await state(page)).e).toBe(true);
  await page.keyboard.press('Escape');
  expect(await state(page)).toMatchObject({ e: false, h: true, paused: false, locked: false });
  const input = page.locator('#editor-hierarchy-explorer input').first();
  await input.fill(''); await input.press('h'); await input.press('e'); await input.press('w');
  expect(await input.inputValue()).toBe('hew');
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.forward)).toBe(false);
  await input.press('Escape');
  expect((await state(page)).h).toBe(true);
  await page.keyboard.press('h');
  expect(await state(page)).toMatchObject({ h: false, locked: false });
  await page.mouse.click(900, 600);
  await expect.poll(async () => (await state(page)).locked).toBe(true);
});

test('Explorer contains deep trees across resize, scrolling, hide and reopen', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).game;
    let parent = null;
    for (let i = 0; i < 45; i++) {
      const group = g.editorHierarchy.createGroup(`Nuevo Grupo ${i}`, parent);
      parent = group.id;
    }
  });
  await page.keyboard.press('h');
  for (const size of [{ width: 1280, height: 800 }, { width: 600, height: 420 }, { width: 300, height: 240 }]) {
    await page.setViewportSize(size);
    const box = await page.locator('#editor-hierarchy-explorer').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    const overflow = await page.evaluate(() => {
      const panel = document.getElementById('editor-hierarchy-explorer')!;
      return Array.from(panel.querySelectorAll('div')).some(el => el.scrollHeight > el.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
    });
    expect(overflow).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#editor-hierarchy-explorer').hover();
  await page.mouse.wheel(0, 2000);
  await page.keyboard.press('h'); await page.keyboard.press('h');
  await expect(page.locator('#editor-hierarchy-explorer')).toBeVisible();
  await page.screenshot({ path: 'test-results/explorer-contained.png' });
});

test('selection opens Inspector without placing; closing stacked panels preserves free cursor', async ({ page }) => {
  await page.evaluate(async () => {
    const g = (window as any).game;
    const THREE = await import('/node_modules/three/build/three.module.js' as string);
    const pos = g.sceneManager.camera.position.clone().add(g.sceneManager.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
    g._loadSingleMapObject({ uuid: 'e2e-wall', type: 'wall', color: 0x44aaff, originalScale: { x: 2, y: 2, z: 1 }, pos, rot: { x: 0, y: 0, z: 0 } });
    g.__uses = 0; g.useCurrentItem = () => g.__uses++;
  });
  await page.keyboard.press('h');
  await page.mouse.click(640, 400);
  await expect.poll(async () => (await state(page)).inspector).toBe(true);
  expect(await page.evaluate(() => (window as any).game.__uses)).toBe(0);
  await page.keyboard.press('e'); await page.keyboard.press('Escape');
  expect(await state(page)).toMatchObject({ e: false, inspector: true, h: true, locked: false, paused: false });
  await page.keyboard.press('Escape');
  expect(await state(page)).toMatchObject({ inspector: false, h: true, locked: false, paused: false });
  await page.keyboard.press('Escape');
  expect(await state(page)).toMatchObject({ h: false, locked: false, paused: false });
});

test('native tree drag reparenting releases ownership and survives close/reopen', async ({ page }) => {
  await page.evaluate(() => {
    const g = (window as any).game;
    g.editorHierarchy.createGroup('Drag source', null, 'drag-source');
    g.editorHierarchy.createGroup('Drop target', null, 'drop-target');
  });
  await page.keyboard.press('h');
  const rows = page.locator('#editor-hierarchy-explorer [draggable="true"]');
  await rows.filter({ hasText: 'Drag source' }).dragTo(rows.filter({ hasText: 'Drop target' }));
  await expect.poll(() => page.evaluate(() => (window as any).game.editorHierarchy.getNode('drag-source').parentId)).toBe('drop-target');
  expect((await state(page)).state).not.toBe('tree-drag');
  await page.keyboard.press('h'); await page.keyboard.press('h');
  expect((await state(page)).locked).toBe(false);
  await expect(rows.filter({ hasText: 'Drag source' })).toBeVisible();
});

test('held H does not toggle repeatedly; losing focus clears movement and stale drag state', async ({ page }) => {
  await page.keyboard.down('h'); await page.keyboard.down('h'); await page.keyboard.up('h');
  expect((await state(page)).h).toBe(true);
  await page.keyboard.press('h');
  await page.keyboard.down('w');
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.forward)).toBe(true);
  // DOM blur notification is synthetic here; keyboard and subsequent UI actions are native.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.forward)).toBe(false);
  await page.keyboard.up('w');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.keyboard.press('h');
  expect((await state(page)).h).toBe(true);
});

test('real transform handle owns the drag; E finalizes it without leaving input disabled', async ({ page }) => {
  await page.evaluate(async () => {
    const g = (window as any).game;
    const THREE = await import('/node_modules/three/build/three.module.js' as string);
    const pos = g.sceneManager.camera.position.clone().add(g.sceneManager.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6));
    g._loadSingleMapObject({ uuid: 'gizmo-wall', type: 'wall', color: 0x44aaff, originalScale: { x: 2, y: 2, z: 1 }, pos, rot: { x: 0, y: 0, z: 0 } });
    g.editorExplorer.show();
    g.editorExplorer.selectNode('gizmo-wall');
  });
  const handle = await page.evaluate(async () => {
    const g = (window as any).game;
    const THREE = await import('/node_modules/three/build/three.module.js' as string);
    const gizmo = g.objectInspector.transformGizmo;
    gizmo.update(); gizmo.helper.updateMatrixWorld(true);
    const picker = gizmo.controls._gizmo.picker.translate.children.find((m: any) => m.name === 'X');
    picker.geometry.computeBoundingBox();
    const point = picker.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(picker.matrixWorld).project(g.sceneManager.camera);
    return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
  });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await expect.poll(async () => (await state(page)).state).toBe('gizmo-drag');
  await page.mouse.move(handle.x + 50, handle.y + 15, { steps: 8 });
  await page.keyboard.press('e');
  await page.mouse.up();
  expect((await state(page)).e).toBe(true);
  expect(await page.evaluate(() => !!(window as any).game.objectInspector.transformGizmo.dragState)).toBe(false);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).game.inputManager.enabled)).toBe(true);
  expect((await state(page)).locked).toBe(false);
});

test('comprehensive: movement with H open, coupling mode top boxes, and full group duplication', async ({ page }) => {
  // 1. Verificar movimiento con H abierto
  await page.keyboard.press('h');
  expect((await state(page)).h).toBe(true);
  expect((await state(page)).locked).toBe(false);

  // WASD debe registrarse con H abierto
  await page.keyboard.down('w');
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.forward)).toBe(true);
  await page.keyboard.up('w');
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.forward)).toBe(false);

  // Clic en canvas no dispara ataque
  await page.mouse.click(800, 500);
  expect(await page.evaluate(() => (window as any).game.inputManager.keys.attack)).toBe(false);

  // 2. Activar modo Acoples
  const btnCoupling = page.locator('#editor-hierarchy-explorer button:has-text("Acoples:")');
  await btnCoupling.click();
  expect(await page.evaluate(() => (window as any).game.editorGroupManager.isCouplingMode())).toBe(true);

  // 3. Crear grupo con 2 objetos y probar duplicación completa
  await page.evaluate(() => {
    const g = (window as any).game;
    const group = g.editorHierarchy.createGroup('Complejo Alpha', null, 'grp-alpha');
    g._loadSingleMapObject({ uuid: 'piece-1', type: 'wall', pos: { x: 5, y: 0, z: 5 }, rot: { x: 0, y: 0, z: 0 }, parentId: 'grp-alpha' });
    g._loadSingleMapObject({ uuid: 'piece-2', type: 'crate', pos: { x: 7, y: 0, z: 5 }, rot: { x: 0, y: 0, z: 0 }, parentId: 'grp-alpha' });
    g.editorExplorer.renderTree();
  });

  // Seleccionar el grupo en Explorer y duplicar
  await page.evaluate(() => {
    const g = (window as any).game;
    g.editorExplorer.selectNode('grp-alpha');
  });

  const btnDuplicate = page.locator('#editor-hierarchy-explorer button:has-text("Duplicar")');
  await btnDuplicate.click();

  const getStats = () => page.evaluate(() => {
    const g = (window as any).game;
    const allGroups = g.editorHierarchy.getAllNodes().filter((n: any) => n.isGroup && n.id !== 'grp-alpha');
    const dupGroup = allGroups[0];
    if (!dupGroup) return { success: false, childCount: 0, types: [] };
    const children = g.editorHierarchy.getChildren(dupGroup.id);
    return {
      success: true,
      dupGroupId: dupGroup.id,
      childCount: children.length,
      types: children.map((c: any) => c.type)
    };
  });

  await expect.poll(async () => (await getStats()).success).toBe(true);
  const stats = await getStats();
  expect(stats.childCount).toBe(2);
  expect(stats.types).toContain('wall');
  expect(stats.types).toContain('crate');
});
