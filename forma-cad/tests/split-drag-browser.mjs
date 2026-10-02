import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { defaults } from '../src/geometry.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
 const pageErrors = [];
 page.on('pageerror', error => pageErrors.push(error.message));
 page.on('dialog', dialog => dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 const box = { ...defaults, id: 'box', name: 'Box', width: 60, height: 40, depth: 20 };
 await page.locator('#file').setInputFiles({
  name: 'split-box.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ format: 'forma-cad', version: 1, features: [box] }))
 });
 await page.waitForFunction(() => document.getElementById('body-count').textContent === '1');
 await page.locator('[data-view=front]').click();
 await page.locator('#fit').click();

 const openSplit = async () => {
  await page.locator('#advanced-tools').click();
  await page.locator('#cad-command').selectOption('split');
  assert.equal(await page.locator('#cad-command').inputValue(), 'split');
  await page.locator('#cad-target').selectOption('box');
  await page.locator('#cad-plane').selectOption('XY');
  await page.waitForFunction(() => document.getElementById('canvas-host').dataset.splitPreview === 'true');
  assert.equal(await page.locator('#split-offset-handle').isVisible(), true);
  assert.equal(await page.locator('#split-distance').isVisible(), true);
  assert.equal(await page.locator('#split-guide').evaluate(el => el.hidden), false);
 };
 const numeric = page.locator('#split-viewport-offset');
 const offset = page.locator('#cad-offset');
 const handle = page.locator('#split-offset-handle');
 const asNumber = async locator => Number(await locator.inputValue());
 const center = rect => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
 const moved = (a, b) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);

 await openSplit();
 const initialHandle = await handle.boundingBox();
 await numeric.fill('8');
 await page.waitForFunction(() => Math.abs(Number(document.getElementById('cad-offset').value) - 8) < 1e-6);
 assert.equal(await asNumber(offset), 8);
 const guideLength = await page.locator('#split-guide-line').evaluate(el => Math.hypot(
  Number(el.getAttribute('x2')) - Number(el.getAttribute('x1')),
  Number(el.getAttribute('y2')) - Number(el.getAttribute('y1'))));
 assert.ok(guideLength > 2, 'offset preview shows a guide from its reference plane');
 const numericHandle = await handle.boundingBox();
 assert.ok(moved(initialHandle, numericHandle) > 2, 'numeric offset moves the visible split-plane handle');
 await page.screenshot({ path: '.sites-runtime/split-preview.png' });

 const cameraBefore = await page.locator('#canvas-host').getAttribute('data-camera-state');
 const from = center(numericHandle);
 await page.mouse.move(from.x, from.y);
 await page.mouse.down();
 await page.mouse.move(from.x, from.y - 75, { steps: 12 });
 await page.mouse.up();
 await page.waitForFunction(() => Math.abs(Number(document.getElementById('cad-offset').value) - 8) > .05);
 assert.ok(Math.abs(await asNumber(numeric) - await asNumber(offset)) < 1e-6,
  'dragging the viewport handle updates the floating and dialog numeric fields');
 const cameraAfter = JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 assert.ok(cameraAfter.every((value, index) => Math.abs(value - JSON.parse(cameraBefore)[index]) < 1e-8),
  'dragging the split offset must not orbit or pan the camera');
 const draggedHandle = await handle.boundingBox();
 assert.ok(moved(numericHandle, draggedHandle) > 2, 'the split-plane preview moves with the drag');
 assert.equal(await page.locator('#canvas-host').getAttribute('data-split-preview'), 'true');

 await page.locator('#cad-cancel').click();
 assert.equal(await page.locator('#feature-count').textContent(), '1');
 assert.equal(await handle.isVisible(), false);
 assert.notEqual(await page.locator('#canvas-host').getAttribute('data-split-preview'), 'true');

 await openSplit();
 await offset.fill('7.5');
 await page.waitForFunction(() => Math.abs(Number(document.getElementById('split-viewport-offset').value) - 7.5) < 1e-6);
 assert.ok(Math.abs(await asNumber(numeric) - 7.5) < 1e-6);
 await page.locator('#cad-apply').click();
 await page.waitForFunction(() => !document.getElementById('tools-dialog').open ||
  (!document.getElementById('cad-apply').disabled && !document.getElementById('cad-error').textContent.includes('計算中')),
  {}, { timeout: 120000 });
 assert.equal(await page.locator('#tools-dialog').isVisible(), false, await page.locator('#cad-error').textContent());
 assert.equal(await page.locator('#body-count').textContent(), '2');
 const download = page.waitForEvent('download');
 await page.locator('#save').click();
 const data = JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
 const split = data.features.at(-1);
 assert.equal(split.spec.type, 'split');
 assert.equal(split.spec.target, 'box');
 assert.equal(split.spec.plane, 'XY');
 assert.ok(Math.abs(split.spec.offset - 7.5) < 1e-6);
 assert.equal(split.outputs.length, 2);
 const ranges = split.outputs.map(output => {
  const zs = output.vertices.filter((_, index) => index % 3 === 2);
  return [Math.min(...zs), Math.max(...zs)];
 }).sort((a, b) => a[0] - b[0]);
 const close = (actual, expected) => Math.abs(actual - expected) < .02;
 assert.ok(close(ranges[0][0], 0) && close(ranges[0][1], 7.5), `lower split body: ${ranges[0]}`);
 assert.ok(close(ranges[1][0], 7.5) && close(ranges[1][1], 20), `upper split body: ${ranges[1]}`);
 assert.deepEqual(pageErrors, []);
 console.log('PASS split viewport numeric/drag sync, preview, camera stability, cancel and 7.5 mm committed bounds');
} finally {
 await browser.close();
}