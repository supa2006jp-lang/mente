import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
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
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec){window.cadJobs.push(payload.spec.type);window.latestSpec=payload.spec;}return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const base={...defaults,id:'body',kind:'extrusion',name:'長方形',width:80,height:50,depth:30,z:3};
 async function load(features){await page.locator('#file').setInputFiles({name:'slide-widths.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{await fs.writeFile('.sites-runtime/slide-labels-failed-spec.json',JSON.stringify(await page.evaluate(()=>window.latestSpec)));throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}
 R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const legacySpec={type:'slideLid',id:'old-slide',target:base.id,lidStyle:'top',wall:4.2,floor:2.4,lidThickness:3.6,railDepth:1.2,cover:1.2,clearance:.25,direction:'long',entry:'negative',pose:'assembled',grip:false,lock:true,lockHeight:.35,leadIn:true,leadInSize:.6};
 const legacyOp={kind:'cadop',id:legacySpec.id,name:'以前のスライド蓋',spec:legacySpec,...runOperation([base],legacySpec)};assert.ok(legacyOp.analysis.lock.slidingContact>0);
 await load([base,legacyOp]);const original=await save();assert.equal(original.features.at(-1).spec.lock,true);assert.ok(original.features.at(-1).analysis.lock);
 await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-lock').count(),0);assert.equal(await page.locator('#slide-lid-lockHeight').count(),0);assert.ok(!(await page.locator('#slide-lid-dialog').textContent()).includes('抜け止め'));assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.25');
 await page.locator('#slide-lid-section').click();const panel=page.locator('#slide-lid-section-panel');assert.equal(await panel.locator('[data-slide-focus=lock]').count(),0);assert.equal(await page.locator('#slide-section-contact').count(),0);assert.ok(!(await panel.textContent()).includes('抜け止め'));await page.locator('#slide-section-opening').fill('50');assert.equal(Number(await panel.getAttribute('data-contact-area')),0);await page.locator('#slide-lid-cancel').click();assert.deepEqual((await save()).features,original.features,'cancel preserves legacy locking geometry and metadata');
 await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.evaluate(()=>window.latestSpec.lock),false);await apply();let removed=await save();assert.equal(removed.features.at(-1).spec.lock,false);assert.equal(removed.features.at(-1).analysis.lock,null);assert.equal(removed.features.at(-1).spec.clearance,.25);assert.equal(removed.features.at(-1).analysis.slidingOverlap,0);assert.equal(removed.features.at(-1).outputs.length,2);
 assert.notDeepEqual(removed.features.at(-1).outputs,original.features.at(-1).outputs,'detent geometry is actually removed');await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.lock,true);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).analysis.lock,null);await load(removed.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.25');await page.locator('#slide-lid-cancel').click();
 console.log('PASS saved locking model import/cancel preservation, removal by re-edit, actual geometry change, open path, save/reload and undo/redo');
 await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();assert.equal(await page.locator('#slide-lid-lock').count(),0);assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'2');await page.locator('#slide-lid-section').click();assert.equal(await panel.locator('[data-slide-focus=lock]').count(),0);await page.locator('#slide-section-opening').fill('100');assert.equal(Number(await panel.getAttribute('data-contact-area')),0);await apply();const created=(await save()).features.at(-1);assert.equal(created.spec.lock,false);assert.equal(created.analysis.lock,null);assert.equal(created.spec.clearance,2);assert.equal(created.analysis.slidingOverlap,0);assert.equal(created.outputs.length,2);assert.deepEqual(errors,[]);console.log('PASS default 2.0 mm slide lid creation without locking options or detent geometry, section view and fully open clearance');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
