import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:30,depth:10}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox(),s=r.height/(Math.hypot(30,30,10)*1.25/Math.min(r.width/r.height,1)),p=(x,y)=>[r.x+r.width/2+x*s,r.y+r.height/2-y*s],host=page.locator('#canvas-host');
 await page.mouse.move(...p(-18,18));await page.mouse.down();await page.mouse.move(...p(18,-18),{steps:6});await page.mouse.up();assert.equal(await host.getAttribute('data-selected-face-count'),'6','Whole box includes bottom and hidden sides');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.visibleAxes==='XY');
 await page.locator('#select-edge-tool').click();await page.mouse.click(...p(-15,0));await page.keyboard.down('Control');await page.mouse.click(...p(15,0));assert.equal(await host.getAttribute('data-selected-edge-count'),'2');await page.mouse.click(...p(15,0));assert.equal(await host.getAttribute('data-selected-edge-count'),'1');await page.mouse.click(...p(15,0));await page.keyboard.up('Control');assert.equal(await host.getAttribute('data-selected-edge-count'),'2');
 await page.mouse.move(20,20);await page.waitForTimeout(100);assert.equal((await page.locator('#edge-overlay-line').getAttribute('d')).split('M').length-1,2);
 await page.locator('#edge-fillet').click();await page.locator('#cad-radius').fill('1');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:120000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const downloaded=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await downloaded).path(),'utf8'));assert.equal(data.features.at(-1).spec.edges.length,2);assert.ok(data.features.at(-1).outputs[0].triangles.length>36);
 assert.deepEqual(errors,[]);console.log('PASS six-face box selection, stable XY grid, two-edge toggle/highlight and fillet');
}finally{await browser.close();}
