import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5188');const cylinder={...defaults,id:'c',name:'円柱',profile:'circle',diameter:10,depth:5};
 await page.locator('#file').setInputFiles({name:'cylinder.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[cylinder]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=front]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox();await page.mouse.click(r.x+r.width/2+40,r.y+r.height/2+20);
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した円柱の側面');
 const open=async()=>{await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('thread');};
 await open();assert.equal(await page.locator('#thread-auto-pull').isChecked(),false);assert.equal(await page.locator('#thread-pull-distance').isDisabled(),true);
 await page.locator('#thread-auto-pull').check();await page.locator('#thread-pull-distance').fill('-.12');await page.locator('#cad-cancel').click();
 await open();await page.locator('#thread-auto-pull').check();assert.equal(await page.locator('#thread-pull-distance').inputValue(),'-0.12');
 await page.locator('#thread-pull-distance').fill('-1');await page.locator('#cad-apply').click();assert.match(await page.locator('#cad-error').textContent(),/40%/);assert.equal(await page.locator('#feature-count').textContent(),'1');
 await page.locator('#thread-pull-distance').fill('-.12');await page.screenshot({path:'.sites-runtime/thread-create-pull.png'});await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:120000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const download=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),op=saved.features.at(-1);
 assert.equal(saved.features.length,2,'Thread and adjustment are created as one operation');assert.deepEqual(op.spec.threadFaceOffsets,[-.12,-.12,-.12,0]);assert.deepEqual(op.outputs[0].threadSource.spec.threadFaceOffsets,[-.12,-.12,-.12,0]);assert.ok(op.outputs[0].triangles.length>100);
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pull');await page.locator('#pull-all-thread').check();assert.equal(await page.locator('#cad-distance').inputValue(),'-0.12');
 assert.deepEqual(errors,[]);console.log('PASS create adjusted thread in one operation, validate distance, and share remembered distance with pull');
}finally{await browser.close();}
