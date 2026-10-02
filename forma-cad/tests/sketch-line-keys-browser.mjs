import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('閉じた'));

 const count=async()=>Number(await page.locator('#feature-count').textContent());
 const save=async()=>{
  const download=page.waitForEvent('download');
  await page.locator('#save').click();
  return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 };
 const clear=async()=>{
  await page.locator('#clear').click();
  await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='0');
 };
 const start=async(continuous)=>{
  await page.locator('#new-line').click();
  continuous?await page.locator('#continuous-line').check():await page.locator('#continuous-line').uncheck();
  const rect=await page.locator('canvas').boundingBox();
  return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
 };

 // Enter in the drawing area places the preview segment and ends the command.
 let {x,y}=await start(false);
 await page.mouse.click(x-180,y+90);
 await page.mouse.move(x-60,y+20);
 await page.keyboard.press('Enter');
 assert.equal(await count(),1,'Enter should place one line');
 assert.equal(await page.locator('#sketch-banner').isVisible(),false,'Enter should end line drawing');
 let lines=(await save()).features;
 assert.equal(lines.length,1);
 assert.equal(lines[0].profile,'line');
 assert.ok(lines[0].width>1,'Enter should use the visible endpoint');
 await clear();

 // With an already committed chain, Enter discards only the next preview.
 ({x,y}=await start(true));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 await page.mouse.click(x-100,y+20);
 assert.equal(await count(),2);
 await page.mouse.move(x-10,y+20);
 await page.locator('#fit').focus();
 await page.keyboard.press('Enter');
 assert.equal(await count(),2,'Enter must not add the unfinished chain segment');
 assert.equal(await page.locator('#sketch-banner').isVisible(),false,'Enter on a focused button should end drawing');
 lines=(await save()).features;
 assert.equal(lines.length,2);
 assert.ok(lines.every(line=>line.profile==='line'&&line.width>1));
 await clear();

 // Enter also ends a chain while the continuous-line checkbox has focus.
 ({x,y}=await start(true));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 await page.mouse.move(x-50,y+20);
 await page.locator('#continuous-line').focus();
 await page.keyboard.press('Enter');
 assert.equal(await count(),1,'checkbox Enter must keep only the committed line');
 assert.equal(await page.locator('#sketch-banner').isVisible(),false,'checkbox Enter should end drawing');
 await clear();

 // Esc cancels a preview without saving it.
 ({x,y}=await start(false));
 await page.mouse.click(x-180,y+90);
 await page.mouse.move(x-60,y+20);
 await page.keyboard.press('Escape');
 assert.equal(await count(),0,'Esc must discard an unfinished line');
 assert.equal(await page.locator('#sketch-banner').isVisible(),false,'Esc should end drawing');
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド','Esc should leave sketch editing');
 await page.mouse.click(x+90,y-80);
 await page.mouse.click(x+140,y-50);
 assert.equal(await count(),0,'clicks after Esc must not resume the line');

 // Esc also cancels a preview while an inline dimension has focus.
 ({x,y}=await start(false));
 await page.mouse.click(x-180,y+90);
 await page.mouse.move(x-60,y+20);
 await page.locator('#sketch-dim-0').focus();
 await page.keyboard.press('Escape');
 assert.equal(await count(),0,'dimension Esc must discard an unfinished line');
 assert.equal(await page.locator('#sketch-banner').isVisible(),false,'dimension Esc should end drawing');

 // Enter inside an inline dimension keeps the existing numeric-placement behavior.
 ({x,y}=await start(false));
 await page.mouse.click(x-180,y+90);
 await page.mouse.move(x-60,y+20);
 await page.locator('#sketch-dim-0').fill('25.5');
 await page.locator('#sketch-dim-1').fill('30');
 await page.locator('#sketch-dim-1').press('Enter');
 assert.equal(await count(),1,'dimension Enter should place exactly one line');
 lines=(await save()).features;
 assert.equal(lines.length,1);
 assert.ok(Math.abs(lines[0].width-25.5)<1e-4,'dimension Enter should preserve length');
 assert.ok(Math.abs(lines[0].angle-30)<1e-4,'dimension Enter should preserve angle');
 await clear();

 // A line completed by two clicks remains in sketch editing until Esc.
 ({x,y}=await start(false));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 assert.equal(await count(),1,'the completed line should be saved');
 assert.equal(await page.locator('#workspace-mode').textContent(),'スケッチ','completed line starts in sketch editing');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド','Esc should exit sketch editing after a completed line');
 await page.waitForFunction(()=>document.getElementById('select-sketch-edge').getAttribute('aria-pressed')==='false');
 await page.mouse.click(x+90,y-80);
 await page.mouse.click(x+140,y-50);
 assert.equal(await count(),1,'Esc should retain the committed line without starting another');
 await clear();

 // Esc leaves sketch editing after a committed continuous segment, discarding only the next preview.
 ({x,y}=await start(true));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 await page.mouse.move(x-50,y+20);
 assert.equal(await count(),1);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド','Esc should exit continuous line editing');
 await page.mouse.click(x+90,y-80);
 await page.mouse.click(x+140,y-50);
 assert.equal(await count(),1,'Esc should retain only the committed continuous segment');
 await clear();

 // Capture-phase Escape must win over other tool listeners, even from a focused number field.
 ({x,y}=await start(true));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 await page.locator('#live-length').focus();
 await page.evaluate(()=>{
  window.__escapeBlocked=false;
  window.__escapeBlocker=e=>{if(e.key==='Escape'){window.__escapeBlocked=true;e.stopImmediatePropagation();}};
  window.addEventListener('keydown',window.__escapeBlocker,{capture:true});
 });
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド','Esc should stop a focused continuous line before later capture listeners');
 assert.equal(await page.evaluate(()=>window.__escapeBlocked),false,'line Escape should be handled first');
 await page.evaluate(()=>window.removeEventListener('keydown',window.__escapeBlocker,{capture:true}));
 await clear();

 // The visible stop button uses the same full exit as Escape.
 ({x,y}=await start(true));
 await page.mouse.click(x-180,y+90);
 await page.mouse.click(x-100,y+90);
 assert.equal(await count(),1);
 await page.locator('#end-sketch').click();
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド','stop button should exit sketch editing');
 await page.mouse.click(x+90,y-80);
 await page.mouse.click(x+140,y-50);
 assert.equal(await count(),1,'stop button should retain only committed lines');
 assert.deepEqual(errors,[]);
 console.log('PASS sketch line Enter/Esc, capture priority, stop button, completed-line exit, and continuous-chain cancel');
}finally{
 await browser.close();
}
