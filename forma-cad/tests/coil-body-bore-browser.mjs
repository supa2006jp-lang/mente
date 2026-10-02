import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5188');
 const project={format:'forma-cad',version:1,features:[{...defaults,id:'body',name:'円柱',kind:'extrusion',profile:'circle',diameter:60,depth:80}]};
 await page.locator('#file').setInputFiles({name:'bore.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('#direct-coil-joint').evaluate(element=>element.click());
 assert.equal(await page.locator('#cad-bodyBoreWall').inputValue(),'1.5');
 await page.locator('#cad-bodyBoreWall').fill('1.5');
 await page.waitForFunction(()=>document.getElementById('coil-calculation-text')?.textContent.includes('穴まわり 1.5 mm'),{},{timeout:240000});
 assert.match(await page.locator('#coil-joint-result').textContent(),/本体内穴 Ø/);
 const dimensions=await page.locator('#coil-calculation-text').textContent();
 assert.match(dimensions,/接合部 4.2 mm/);
 assert.deepEqual(errors,[]);
 console.log('PASS independent bore field, preview and displayed dimensions');
} finally {
 await browser.close();
}
