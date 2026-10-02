import {chromium} from 'playwright';import assert from 'node:assert/strict';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188');
 for(const plane of ['XZ','YZ','XY']){await page.locator('#reference-plane').selectOption(plane);await page.locator('#new-line').click();await page.waitForFunction(p=>document.getElementById('active-plane').textContent==='作図中：'+p,plane);await page.keyboard.press('Escape');}
 await page.locator('#reference-plane').selectOption('XY');
 await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:30,depth:20}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=right]').click();await page.locator('#fit').click();const r=await page.locator('canvas').boundingBox();await page.mouse.click(r.x+r.width/2+30,r.y+r.height/2+20);await page.waitForFunction(()=>document.getElementById('active-plane').textContent==='選択面：YZ');assert.equal(await page.locator('#reference-plane').inputValue(),'XY');
 await page.keyboard.press('Escape');await page.locator('#new-line').click();await page.waitForFunction(()=>document.getElementById('active-plane').textContent==='作図中：XY');assert.deepEqual(errors,[]);console.log('PASS manual plane switching and stale selected face does not leak into next sketch');
}finally{await browser.close();}
