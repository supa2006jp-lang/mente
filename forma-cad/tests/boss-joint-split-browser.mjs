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

 await load([base]);await page.locator('#boss-joint-tool').click();await ready();
 assert.deepEqual(JSON.parse(await page.locator('#boss-joint-split-depths').getAttribute('data-depths')),[15,15]);
 await page.locator('#boss-joint-split-adjust').click();const handle=page.locator('#boss-split-handle');await handle.waitFor({state:'visible'});assert.equal(await page.locator('#boss-joint-split-adjust').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(300);const camera=await page.locator('[data-camera-state]').getAttribute('data-camera-state');const jobs=await page.evaluate(()=>cadJobs.length);
 await handle.focus();await page.keyboard.press('ArrowUp');await ready();assert.equal(await page.locator('#boss-joint-offset').inputValue(),'16');assert.equal((await analysis()).offset,16);assert.deepEqual(JSON.parse(await page.locator('#boss-joint-split-depths').getAttribute('data-depths')),[16,14]);assert.ok(JSON.parse(await page.locator('[data-camera-state]').getAttribute('data-camera-state')).every((v,i)=>Math.abs(v-JSON.parse(camera)[i])<1e-7));
 await handle.focus();await page.keyboard.press('Shift+ArrowDown');await ready();assert.equal(await page.locator('#boss-joint-offset').inputValue(),'15.9');
 const before=Number(await page.locator('#boss-joint-offset').inputValue()),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-15,{steps:5});assert.notEqual(Number(await page.locator('#boss-joint-offset').inputValue()),before);assert.ok(await page.locator('#boss-joint-apply').isDisabled());const during=await page.evaluate(()=>cadJobs.length);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>cadJobs.length),during,'moving only updates the plane, not CAD');await page.keyboard.press('Escape');await page.mouse.up();assert.equal(Number(await page.locator('#boss-joint-offset').inputValue()),before);assert.ok(await page.locator('#boss-joint-dialog').isVisible());assert.ok(!await page.locator('#boss-joint-apply').isDisabled());
 const box2=await handle.boundingBox();await page.mouse.move(box2.x+box2.width/2,box2.y+box2.height/2);await page.mouse.down();await page.mouse.move(box2.x+box2.width/2,box2.y+box2.height/2-10,{steps:4});const moved=Number(await page.locator('#boss-joint-offset').inputValue());await page.mouse.up();await ready();assert.equal((await analysis()).offset,moved);assert.ok(JSON.parse(await page.locator('[data-camera-state]').getAttribute('data-camera-state')).every((v,i)=>Math.abs(v-JSON.parse(camera)[i])<1e-7),'drag does not rotate or zoom');
 await page.locator('#boss-joint-offset').fill('12');await ready();assert.equal(await handle.getAttribute('data-offset'),'12');assert.deepEqual(JSON.parse(await page.locator('#boss-joint-split-depths').getAttribute('data-depths')),[12,18]);await page.screenshot({path:'.sites-runtime/boss-joint-split-drag.png'});
 await page.locator('#boss-joint-offset').fill('0');await page.waitForFunction(()=>document.querySelector('[data-boss-joint-invalid]'));assert.ok(await page.locator('#boss-joint-apply').isDisabled());assert.ok(!await handle.isDisabled());await page.locator('#boss-joint-offset').fill('12');await ready();
 await page.locator('#boss-joint-split-adjust').click();assert.ok(!await handle.isVisible());await page.locator('#boss-joint-plane').selectOption('XZ');await ready();assert.deepEqual(JSON.parse(await page.locator('#boss-joint-split-depths').getAttribute('data-depths')),[20,20]);await page.locator('#boss-joint-split-adjust').click();await handle.focus();await page.keyboard.press('ArrowUp');await ready();assert.equal((await analysis()).offset,1);await page.locator('#boss-joint-split-adjust').click();
 await page.locator('#boss-joint-plane').selectOption('YZ');await ready();assert.deepEqual(JSON.parse(await page.locator('#boss-joint-split-depths').getAttribute('data-depths')),[30,30]);await page.locator('#boss-joint-pose').selectOption('assembled');await ready();await page.locator('#boss-joint-split-adjust').click();await handle.focus();await page.keyboard.press('Shift+ArrowUp');await ready();assert.equal((await analysis()).offset,0.1);
 await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);assert.ok(!await handle.isVisible());const saved=await save();assert.equal(saved.features.at(-1).spec.offset,0.1);await page.locator('#undo').click();assert.equal((await save()).features.length,1);await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.equal(await page.locator('#boss-joint-offset').inputValue(),'0.1');await page.locator('#boss-joint-split-adjust').click();await close();assert.ok(!await handle.isVisible());assert.equal((await save()).features.at(-1).spec.offset,0.1);
 await load([base]);await page.setViewportSize({width:1280,height:900});await page.locator('#boss-joint-tool').click();await ready();await page.locator('#boss-joint-split-adjust').click();await handle.waitFor({state:'visible'});await page.waitForTimeout(300);assert.ok((await handle.boundingBox()).x+80<(await page.locator('#boss-joint-dialog').boundingBox()).x,'handle stays beside the dialog');await page.screenshot({path:'.sites-runtime/boss-joint-split-small.png'});await close();assert.ok(!await handle.isVisible());assert.deepEqual(errors,[]);console.log('PASS split plane mouse/keyboard drag, live depths, numeric sync, Esc restore, deferred rebuild, unchanged camera, all axes/poses, invalid recovery, persistence/edit/undo, small viewport and cleanup');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
