import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5188');
 const feature={...defaults,id:'base',name:'ベース',kind:'extrusion',width:30,height:30,depth:10};
 await page.locator('#file').setInputFiles({name:'face.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[feature]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#selection-mode').selectOption('face');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 const box=await page.locator('canvas').boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 assert.ok((await page.locator('#measurement-title').textContent()).includes('平面'));
 await page.locator('#solid-tool').click();
 assert.equal(await page.locator('#operation').inputValue(),'join');
 await page.locator('#viewport-depth').fill('-5');
 await page.waitForFunction(()=>document.getElementById('operation').value==='cut');
 assert.equal(await page.locator('#target').inputValue(),'base');
 await page.locator('#viewport-depth').fill('5');
 await page.waitForFunction(()=>document.getElementById('operation').value==='join');
 assert.deepEqual(errors,[]);
 console.log('PASS face extrusion inward auto cut and outward join');
}finally{await browser.close();}