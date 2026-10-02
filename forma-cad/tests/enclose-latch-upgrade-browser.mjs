import {chromium} from 'playwright';
import {defaults,validateProject} from '../src/geometry.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1200},acceptDownloads:true});
 const errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 const features=[{...defaults,id:'box',name:'対象',width:30,height:20,depth:20,x:0,y:0}];
 await page.locator('#file').setInputFiles({name:'box.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-enclose').evaluate(element=>element.click());
 await page.locator('#cad-boxMode').check();
 await page.locator('#cad-hinge').check();
 await page.locator('#cad-snapLatch').check();
 assert.equal(await page.locator('#cad-latchGap').inputValue(),'0.3','new BOX default clearance');
 assert.equal(await page.locator('#cad-latchEngagement').inputValue(),'1.3','new BOX default engagement');
 assert.equal(await page.locator('#cad-latchEngagement').getAttribute('max'),'1.5','engagement allows a deeper catch');
 assert.equal(await page.locator('#enclose-stronger-latch').isVisible(),false,'upgrade button is for existing BOXes');

 // Create a BOX with the previous settings to exercise the existing-BOX upgrade path.
 await page.locator('#cad-latchGap').fill('0.45');
 await page.locator('#cad-latchEngagement').fill('0.25');
 await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
 assert.equal(await page.locator('#body-count').textContent(),'3');
 await page.locator('#features .tree-row').last().locator('button.row-label').click();
 assert.equal(await page.locator('#cad-latchGap').inputValue(),'0.45');
 assert.equal(await page.locator('#cad-latchEngagement').inputValue(),'0.25');
 assert.equal(await page.locator('#enclose-stronger-latch').isVisible(),true,'upgrade button appears while editing');
 await page.locator('#enclose-stronger-latch').click();
 assert.equal(await page.locator('#cad-latchGap').inputValue(),'0.3');
 assert.equal(await page.locator('#cad-latchEngagement').inputValue(),'1.3');
 await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 validateProject(data);
 const operation=data.features.at(-1);
 assert.equal(operation.kind,'cadop');
 assert.equal(operation.spec.type,'enclose');
 assert.equal(operation.spec.boxMode,true);
 assert.equal(operation.spec.snapLatch,true);
 assert.equal(operation.spec.latchGap,0.3);
 assert.equal(operation.spec.latchEngagement,1.3);
 assert.deepEqual(errors,[]);
 console.log('PASS new BOX latch defaults and existing BOX stronger-latch upgrade persist in saved spec');
}finally{await browser.close();}