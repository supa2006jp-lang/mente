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
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('ball-joint-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#ball-joint-error').textContent());}}
 async function analysis(){return page.locator('[data-ball-joint]').evaluate(el=>JSON.parse(el.dataset.ballJoint));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#ball-joint-cancel').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);}

 const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40};
 await load([cylinder]);await page.locator('#ball-joint-tool').click();await ready();assert.ok(await page.locator('#ball-joint-fixBallChamfer').isDisabled());
 await page.locator('#ball-joint-fixHole').check();await ready();for(const side of ['Ball','Socket']){assert.equal(await page.locator('#ball-joint-fix'+side+'Chamfer').isChecked(),false);assert.ok(await page.locator('#ball-joint-fix'+side+'ChamferSize').isDisabled());assert.equal(await page.locator('#ball-joint-fix'+side+'ChamferSize').inputValue(),'0.3');}
 await page.locator('#ball-joint-fixBallChamfer').check();await page.locator('#ball-joint-fixBallChamferSize').fill('0.6');await page.locator('#ball-joint-fixBallDepth').fill('5');await page.locator('#ball-joint-fixSocketChamfer').check();await ready();let a=await analysis();assert.deepEqual(a.fixingHoles.map(h=>[h.role,h.chamfer,h.chamferSize]),[['ball',true,.6],['socket',true,.3]]);assert.ok(Math.abs(a.fixingHoles[0].entryDiameter-7.6)<1e-9);assert.ok(Math.abs(a.fixingHoles[1].entryDiameter-7)<1e-9);assert.ok(a.overlap.every(v=>v<1e-5));console.log('PASS independent entry chamfers, controls and default-off');
 await page.locator('#ball-joint-fixSocketChamferSize').fill('1');await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('受け側の面取り後のねじが短すぎ'));assert.ok(await page.locator('#ball-joint-apply').isDisabled());
 await page.locator('#ball-joint-fixSocketChamfer').uncheck();await ready();assert.equal((await analysis()).fixingHoles[1].chamfer,false);assert.ok(await page.locator('#ball-joint-fixSocketChamferSize').isDisabled());
 await page.locator('#ball-joint-fixSocketChamfer').check();await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('受け側の面取り後のねじが短すぎ'));
 await page.locator('#ball-joint-fixSide').selectOption('ball');await ready();assert.equal((await analysis()).fixingHoles.length,1);assert.ok(await page.locator('#ball-joint-fixSocketChamfer').isDisabled());
 await page.locator('#ball-joint-fixSide').selectOption('both');await page.locator('#ball-joint-fixSocketChamferSize').fill('0.3');await page.locator('#ball-joint-fixBallDiameter').fill('20');await page.locator('#ball-joint-fixBallChamferSize').fill('0.7');await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('球側の面取り後の入口が薄すぎ'));assert.ok(await page.locator('#ball-joint-apply').isDisabled());
 await page.locator('#ball-joint-fixBallDiameter').fill('6');await page.locator('#ball-joint-fixBallChamferSize').fill('0.6');await ready();await page.locator('#ball-joint-fixBallChamfer').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/ball-joint-fix-chamfer-controls.png'});
 await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);const saved=await save();assert.equal(saved.features.at(-1).spec.fixBallChamfer,true);assert.equal(saved.features.at(-1).spec.fixBallChamferSize,.6);assert.equal(saved.features.at(-1).spec.fixSocketChamferSize,.3);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.fixBallChamferSize,.6);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-fixBallChamfer').isChecked(),true);assert.equal(await page.locator('#ball-joint-fixBallChamferSize').inputValue(),'0.6');assert.equal((await analysis()).fixingHoles[1].chamferSize,.3);
 await page.locator('#ball-joint-fixBallChamferSize').fill('0.4');await close();assert.equal((await save()).features.at(-1).spec.fixBallChamferSize,.6);
 const old=structuredClone(saved);for(const key of Object.keys(old.features.at(-1).spec))if(key.includes('Chamfer'))delete old.features.at(-1).spec[key];await load(old.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();for(const side of ['Ball','Socket']){assert.equal(await page.locator('#ball-joint-fix'+side+'Chamfer').isChecked(),false);assert.ok(await page.locator('#ball-joint-fix'+side+'ChamferSize').isDisabled());}assert.ok((await analysis()).fixingHoles.every(h=>h.chamfer===false));await close();
 console.log('PASS per-side strength guards, disabled options, save/reload/edit/cancel, undo/redo and legacy opt-out');

 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
