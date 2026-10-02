import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {defaults} from '../src/geometry.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:5188');await page.locator('#file').setInputFiles({name:'boxes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[-15,15].map((x,i)=>({...defaults,id:'b'+i,name:'box'+i,width:10,height:10,depth:10,x}))}))});
 await page.locator('#project-preview-open').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2');await page.locator('[data-view=top]').click();await page.locator('#fit').click();
 const canvas=page.locator('canvas'),r=await canvas.boundingBox(),scale=r.height/(Math.hypot(40,10,10)*1.25/Math.min(r.width/r.height,1)),p=(x,y)=>[r.x+r.width/2+x*scale,r.y+r.height/2-y*scale],count=async()=>Number(await page.locator('#canvas-host').getAttribute('data-selected-face-count'));
 async function drag(a,b,add=false){if(add)await page.keyboard.down('Control');await page.mouse.move(...p(...a));await page.mouse.down();await page.mouse.move(...p(...b),{steps:6});assert.equal(await page.locator('#selection-box').isVisible(),true);await page.mouse.up();if(add)await page.keyboard.up('Control');}
 await drag([-22,8],[-8,-8]);assert.equal(await count(),6,'Whole-body window includes hidden faces');
 await drag([-18,3],[-12,-3]);assert.equal(await count(),0,'Partial containment does not select');
 await drag([-12,3],[-18,-3]);assert.equal(await count(),1,'Crossing selects a touched face');
 await drag([18,3],[12,-3],true);assert.equal(await count(),2,'Control adds to selection');
 await page.mouse.move(...p(-22,8));await page.mouse.down();await page.mouse.move(...p(22,-8),{steps:6});await page.screenshot({path:'.sites-runtime/box-selection.png'});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.locator('#selection-box').isVisible(),false);assert.equal(await count(),0,'Escape clears selection');await drag([-12,3],[-18,-3]);await drag([18,3],[12,-3],true);
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pull');await page.locator('#cad-distance').fill('-0.2');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:120000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const download=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),op=saved.features.at(-1);assert.equal(op.spec.faces.length,2);assert.equal(op.outputs.length,2);
 await page.keyboard.down('Alt');await page.mouse.move(...p(-5,0));await page.mouse.down();await page.mouse.move(...p(3,3),{steps:6});assert.equal(await page.locator('#selection-box').isVisible(),false,'Alt drag remains orbit');await page.mouse.up();await page.keyboard.up('Alt');
 assert.deepEqual(errors,[]);console.log('PASS window/crossing selection, visible faces, additive selection, cancel, orbit and multi-body pull');
}finally{await browser.close();}
