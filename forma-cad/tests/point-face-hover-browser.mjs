import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:20,depth:10,x:20,z:30}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,host=page.locator('#canvas-host'),state=async()=>JSON.parse(await host.getAttribute('data-move-preview'));
 await page.locator('#move-tool').click();await page.mouse.click(cx+30,cy+20);assert.equal(await page.locator('#move-apply').isEnabled(),true);



 await page.locator('#move-point-to-point').click();const buttons=page.locator('#move-center-markers button'),n=await buttons.count();let visibleCount=0;for(let i=0;i<n;i++){const item=buttons.nth(i),box=await item.boundingBox();if(!box)continue;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const visible=await buttons.evaluateAll(bs=>bs.filter(b=>getComputedStyle(b).visibility==='visible').map(b=>JSON.parse(b.dataset.point)));for(const point of visible){assert.ok(Math.abs(point[2]-40)<.001,'Only top-face points visible');visibleCount++;}}assert.ok(visibleCount>0);console.log('PASS hovered top face shows front points, hides rear points');
}finally{await browser.close();}
