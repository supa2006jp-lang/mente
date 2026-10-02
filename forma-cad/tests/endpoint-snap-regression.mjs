import {chromium} from 'playwright';import assert from 'node:assert/strict';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}});
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:30,depth:10}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const r=await page.locator('canvas').boundingBox();await page.mouse.click(r.x+r.width/2+30,r.y+r.height/2+30);await page.locator('#new-line').click();await page.locator('#snap-enabled').uncheck();
 const scale=r.height/(360*Math.tan(Math.PI/9)),cx=r.width/2,cy=r.height/2;
 for(const [x,y] of [[-15,-15],[15,-15],[15,15],[-15,15]]){
  await page.mouse.move(r.x+cx+x*scale+1,r.y+cy-y*scale+1);await page.waitForTimeout(60);
  assert.equal(await page.locator('#canvas-host').getAttribute('data-snap-kind'),'endpoint');
  const icon=await page.locator('#snap-icon').evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
  assert.ok(Math.hypot(icon.x-(cx+x*scale),icon.y-(cy-y*scale))<.1,'Corner must not be mutated into midpoint');
 }
 await page.mouse.move(r.x+cx+1,r.y+cy+15*scale+1);await page.waitForTimeout(60);assert.equal(await page.locator('#canvas-host').getAttribute('data-snap-kind'),'midpoint');
 await page.mouse.move(r.x+cx+4,r.y+cy+15*scale);await page.waitForTimeout(60);assert.equal(await page.locator('#canvas-host').getAttribute('data-snap-kind'),'free');
 console.log('PASS all four corner snaps stay at corners; midpoint only snaps within two pixels');
}finally{await browser.close();}
