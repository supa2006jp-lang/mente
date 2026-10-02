import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:20,depth:10,x:20,z:30}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,host=page.locator('#canvas-host'),state=async()=>JSON.parse(await host.getAttribute('data-move-preview'));
 await page.locator('#move-tool').click();await page.mouse.click(cx+30,cy+20);assert.equal(await page.locator('#move-apply').isEnabled(),true);

 await page.locator('#move-rx').fill('30');await page.locator('#move-x').fill('12.5');await page.locator('#move-to-grid').click();const z=Number(await page.locator('#move-z').inputValue());assert.ok(z<0);await page.locator('#move-to-grid').click();assert.equal(Number(await page.locator('#move-z').inputValue()),z);assert.equal(await page.locator('#move-x').inputValue(),'12.5');assert.equal(await page.locator('#move-rx').inputValue(),'30');
 await page.locator('#move-apply').click();await page.waitForFunction(()=>document.getElementById('move-panel').hidden,{},{timeout:120000});
 const download=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),op=data.features.at(-1),zs=op.outputs[0].vertices.filter((v,i)=>i%3===2);assert.ok(Math.abs(Math.min(...zs))<.0001);assert.equal(op.spec.x,12.5);assert.deepEqual(op.spec.rotation,[30,0,0]);await page.locator('#undo').click();assert.equal(await page.locator('#feature-count').textContent(),'1');assert.deepEqual(errors,[]);console.log('PASS rotated body grounded, horizontal location preserved, repeat click stable, commit and undo');
 await page.reload();
 await page.locator('#file').setInputFiles({name:'below-grid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'below',name:'below grid',width:30,height:20,depth:10,x:20,z:-30}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const belowCanvas=await page.locator('canvas').boundingBox();
 await page.locator('#move-tool').click();await page.mouse.click(belowCanvas.x+belowCanvas.width/2+30,belowCanvas.y+belowCanvas.height/2+20);
 assert.equal(await page.locator('#move-apply').isEnabled(),true);
 assert.match(await page.locator('#move-to-grid').textContent(),/上げる/);
 await page.locator('#move-to-grid').click();
 const upward=Number(await page.locator('#move-z').inputValue());assert.ok(upward>0);
 assert.match(await page.locator('#move-to-grid').textContent(),/接地済み/);
 await page.locator('#move-to-grid').click();assert.equal(Number(await page.locator('#move-z').inputValue()),upward);
 await page.locator('#move-apply').click();await page.waitForFunction(()=>document.getElementById('move-panel').hidden,{},{timeout:120000});
 const belowDownload=page.waitForEvent('download');await page.locator('#save').click();
 const belowData=JSON.parse(await fs.readFile(await(await belowDownload).path(),'utf8'));
 const belowVertices=belowData.features.at(-1).outputs[0].vertices;
 const belowZ=belowVertices.filter((v,i)=>i%3===2);
 assert.ok(Math.abs(Math.min(...belowZ))<.0001);
 assert.ok(Math.max(...belowZ)>0);
 assert.deepEqual(errors,[]);
 console.log('PASS below-grid body raised, bottom grounded, repeat click stable, commit and save');
}finally{await browser.close();}
