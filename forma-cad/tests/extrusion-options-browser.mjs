import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 const features=[
  {...defaults,id:'a',name:'下ボディ',kind:'extrusion',width:24,height:24,z:0,depth:10},
  {...defaults,id:'b',name:'上ボディ',kind:'extrusion',width:24,height:24,z:15,depth:7},
  {...defaults,id:'s',name:'切り取り輪郭',kind:'sketch',profile:'circle',diameter:8,z:25}
 ];
 await page.locator('#file').setInputFiles({name:'extrusion-options.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2'&&document.getElementById('region-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 const box=await page.locator('canvas').boundingBox();
 const begin=async()=>{
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.locator('#solid-tool').click();
  assert.ok(await page.locator('#extrude-distance').isVisible());
 };
 await begin();
 await page.locator('#viewport-depth').fill('-5');
 await page.waitForFunction(()=>document.getElementById('operation').value==='cut');
 assert.equal(await page.locator('#target').inputValue(),'b');
 await page.locator('#viewport-operation').selectOption('new');
 await page.locator('#viewport-depth').fill('-6');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#operation').inputValue(),'new');
 await page.locator('#viewport-extrude-cancel').click();
 await page.reload();
 await page.locator('#file').setInputFiles({name:'extrusion-options.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2'&&document.getElementById('region-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await begin();
 await page.locator('#viewport-grid-extent').check();
 assert.equal(await page.locator('#depth').inputValue(),'-25');
 assert.ok(await page.locator('#viewport-depth').isDisabled());
 await page.waitForFunction(()=>document.getElementById('operation').value==='cut');
 await page.locator('#viewport-cut-all-bodies').check();
 await page.locator('#extrude-distance button[type=submit]').click();
 await page.waitForFunction(()=>document.getElementById('status').textContent==='押し出し加工を確定しました',{},{timeout:20000});
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 const cut=saved.features.at(-1);
 assert.equal(cut.operation,'cut');
 assert.equal(cut.depth,-25);
 assert.equal(cut.gridExtentPlane,'XY');
 assert.equal(cut.cutAllBodies,true);
 assert.deepEqual(cut.cadResult.outputs.map(output=>output.id),['a','b']);
 assert.equal(await page.locator('#body-count').textContent(),'2');
 await page.reload();
 await page.locator('#file').setInputFiles({name:'saved.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='4');
 await page.locator('#features .row-label').last().click();
 assert.ok(await page.locator('#grid-extent').isChecked());
 assert.ok(await page.locator('#cut-all-bodies').isChecked());
 assert.equal(await page.locator('#depth').inputValue(),'-25');
 assert.deepEqual(errors,[]);
 console.log('PASS auto cut, manual override, grid plane extent, all-body cut and save');
}finally{await browser.close();}