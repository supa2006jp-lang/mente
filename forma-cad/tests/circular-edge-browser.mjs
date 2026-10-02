import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
const box={...defaults,id:'box',name:'box',width:30,height:30,depth:10},hole={...defaults,id:'hole',name:'hole',profile:'circle',diameter:10,z:10,depth:-10,hole:true,operation:'cut',target:'box'};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'hole.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box,hole]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').click();await page.locator('#fit').click();await page.locator('#select-edge-tool').click();
 const r=await page.locator('canvas').boundingBox(),scale=r.height/(Math.hypot(30,30,10)*1.25/Math.min(r.width/r.height,1)),cx=r.x+r.width/2,cy=r.y+r.height/2;
 await page.mouse.click(cx+5*scale,cy);await page.mouse.move(30,30);await page.waitForTimeout(100);
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した円周');
 assert.match(await page.locator('#measurement-length').textContent(),/31\.4159/);assert.match(await page.locator('#measurement-angle').textContent(),/直径 10 mm/);
 assert.ok((await page.locator('#edge-overlay-line').getAttribute('d')).split('L').length>100,'Entire circular rim is highlighted');
 assert.equal(await page.locator('#edge-end-a').isVisible(),false,'A circle must not show artificial endpoints');
 await page.screenshot({path:'.sites-runtime/circular-edge-selected.png'});
 await page.mouse.click(cx+15*scale,cy);await page.mouse.move(30,30);await page.waitForTimeout(100);
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した辺');assert.match(await page.locator('#measurement-length').textContent(),/30 mm/);
 assert.deepEqual(errors,[]);console.log('PASS whole circular rim selection, circumference, diameter and straight edge selection');
}finally{await browser.close();}
