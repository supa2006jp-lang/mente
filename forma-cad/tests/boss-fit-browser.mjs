import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const prefix='/mente/forma-cad/',root=path.resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!url.startsWith(prefix)){res.writeHead(404);return res.end();}
  let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:60,height:40,depth:30},cavity={...defaults,id:'cavity',kind:'extrusion',name:'空洞',profile:'rect',operation:'cut',target:'body',width:55,height:35,depth:25,z:2.5};
 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('boss-joint-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#boss-joint-error').textContent());}}
 async function analysis(){return page.locator('[data-boss-joint]').evaluate(el=>JSON.parse(el.dataset.bossJoint));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#boss-joint-cancel').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);}
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await load([base]);await page.locator('#boss-joint-tool').click();await ready();assert.equal(await page.locator('#boss-joint-fitPreset').inputValue(),'standard');assert.equal(await page.locator('#boss-joint-clearance').inputValue(),'0.15');assert.equal((await analysis()).holeDiameter,3.3);
 for(const [id,gap]of [['loose',.25],['tight',.1],['standard',.15]]){await page.locator('#boss-joint-fitPreset').selectOption(id);await ready();assert.equal(Number(await page.locator('#boss-joint-clearance').inputValue()),gap);assert.equal((await analysis()).holeDiameter,3+gap*2);}
 await page.locator('#boss-joint-clearance').fill('0.2');await ready();assert.equal(await page.locator('#boss-joint-fitPreset').inputValue(),'custom');await page.locator('#boss-joint-diameter').fill('4');await page.locator('#boss-joint-length').fill('5');await page.locator('#boss-joint-bossWall').fill('1.4');await ready();
 let downloads=0;page.on('download',()=>downloads++);const projectBefore=await save(),download=page.waitForEvent('download');await page.locator('#boss-joint-test-export').click();const file=await download,buffer=await fs.readFile(await file.path());assert.match(file.suggestedFilename(),/^boss-fit-D4-L5.*\.stl$/);assert.ok(buffer.length>10000);assert.equal(buffer.length,84+50*buffer.readUInt32LE(80),'STL is complete binary triangle data');await page.waitForFunction(()=>document.querySelector('[data-boss-fit-test]'));const test=await page.locator('[data-boss-fit-test]').evaluate(el=>JSON.parse(el.dataset.bossFitTest));assert.deepEqual(test.clearances,[.1,.15,.2,.25]);assert.equal(test.diameter,4);assert.equal(test.length,5);assert.equal(test.bossWall,1.4);assert.equal(test.count,8);assert.deepEqual((await save()).features,projectBefore.features,'test STL never modifies the model');assert.equal(await page.locator('#boss-joint-fitPreset').inputValue(),'custom');await page.screenshot({path:'.sites-runtime/boss-fit-controls.png'});
 await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);const saved=await save();assert.equal(saved.features.at(-1).spec.clearance,.2);await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.clearance,.2);
 await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.equal(await page.locator('#boss-joint-fitPreset').inputValue(),'custom');await page.locator('#boss-joint-fitPreset').selectOption('standard');await ready();await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);assert.equal((await save()).features.at(-1).spec.clearance,.15);
 await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();await page.locator('#boss-joint-fitPreset').selectOption('loose');await ready();await close();assert.equal((await save()).features.at(-1).spec.clearance,.15);
 await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();const testJobs=await page.evaluate(()=>cadJobs.filter(t=>t==='bossFitTest').length);page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await page.locator('#boss-joint-test-export').click();await page.waitForFunction(()=>document.getElementById('boss-joint-test-status').textContent.includes('キャンセル'));assert.equal(await page.evaluate(()=>cadJobs.filter(t=>t==='bossFitTest').length),testJobs);page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.locator('#boss-joint-diameter').fill('0');await page.locator('#boss-joint-test-export').click();assert.match(await page.locator('#boss-joint-test-status').textContent(),/正しく/);assert.equal(await page.evaluate(()=>cadJobs.filter(t=>t==='bossFitTest').length),testJobs);await close();
 await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();await page.locator('#boss-joint-test-export').click();await page.locator('#boss-joint-cancel').click();await page.waitForTimeout(500);assert.equal(await page.locator('[data-boss-fit-test]').count(),0);assert.equal((await save()).features.at(-1).spec.clearance,.15);
 await page.setViewportSize({width:1280,height:900});await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.equal(await page.locator('#boss-joint-fitPreset').inputValue(),'standard');await close();assert.deepEqual(errors,[]);console.log('PASS preset numeric sync, actual hole diameters, labelled 8-part binary STL, source unchanged, save/reload/reedit, undo/redo, picker/calculation cancellation and invalid dimensions');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
