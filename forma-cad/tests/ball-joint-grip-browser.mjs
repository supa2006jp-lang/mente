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
 await load([cylinder]);await page.locator('#ball-joint-tool').click();await ready();assert.equal(await page.locator('#ball-joint-socketInset').inputValue(),'0');
 await page.locator('#ball-joint-extra-clamp-preset').click();await ready();const old=await analysis();await page.locator('#ball-joint-grip-preset').click();await ready();let a=await analysis();assert.equal(a.socketInset,.15);assert.ok(Math.abs(a.effectiveBallClearance-.1)<1e-9);assert.equal(a.extraClampTravel,.6);assert.equal(a.coneClearance,.05);assert.equal(a.availableTravel,old.availableTravel);assert.equal(a.settings.threadClearance,old.settings.threadClearance);assert.ok(Math.abs(a.clampReserve-old.clampReserve-.15)<1e-9);assert.ok((await page.locator('#ball-joint-info').textContent()).includes('受け内面の片側すき間 0.100'));
 await page.locator('#ball-joint-section').click();const panel=page.locator('#ball-clamp-section-panel');await panel.locator('[data-ball-clamp-at="ball"]').click();const state=await panel.evaluate(el=>JSON.parse(el.dataset.state));assert.ok(Math.abs(state.clampingTravel-a.clampingTravel)<1e-8);assert.ok(a.clampingTravel<old.clampingTravel);await panel.locator('#ball-clamp-close').click();
 await page.locator('#ball-joint-socketInset').fill('0.21');await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('0.05'));assert.ok(await page.locator('#ball-joint-apply').isDisabled());await page.locator('#ball-joint-grip-preset').click();await ready();await page.locator('#ball-joint-grip-preset').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/ball-joint-grip-controls.png'});console.log('PASS independent inner-socket preset, preserved matching nut settings, gap guard and updated section');
 await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);const saved=await save();assert.equal(saved.features.at(-1).spec.socketInset,.15);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.socketInset,.15);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-socketInset').inputValue(),'0.15');await page.locator('#ball-joint-socketInset').fill('0.2');await close();assert.equal((await save()).features.at(-1).spec.socketInset,.15);
 const legacy=structuredClone(saved);delete legacy.features.at(-1).spec.socketInset;await load(legacy.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-socketInset').inputValue(),'0');assert.equal((await analysis()).effectiveBallClearance,.25);await close();console.log('PASS save/reload/edit/cancel, undo/redo and old-file geometry preservation');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
