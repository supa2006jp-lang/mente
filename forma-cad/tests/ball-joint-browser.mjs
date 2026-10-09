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
 await load([cylinder]);await page.locator('#ball-joint-tool').click();await ready();let a=await analysis();assert.equal(a.roles.length,3);assert.equal(a.pose,'print');assert.ok(a.overlap.every(v=>v<1e-5));assert.equal(a.slotCount,4);await page.screenshot({path:'.sites-runtime/ball-joint-print.png'});
 await page.locator('#ball-joint-pose').selectOption('exploded');await ready();assert.equal((await analysis()).pose,'exploded');await page.screenshot({path:'.sites-runtime/ball-joint-exploded.png'});await page.locator('#ball-joint-pose').selectOption('assembled');await ready();assert.equal((await analysis()).pose,'assembled');const jobs=await page.evaluate(()=>cadJobs.length);await page.locator('#ball-joint-transparent').check();assert.equal(await page.evaluate(()=>cadJobs.length),jobs,'transparency does not rebuild the CAD');await page.screenshot({path:'.sites-runtime/ball-joint-assembled.png'});
 const validDiameter=await page.locator('#ball-joint-ballDiameter').inputValue();await page.locator('#ball-joint-ballDiameter').fill('100');await page.waitForFunction(()=>/足りません/.test(document.getElementById('ball-joint-error').textContent));assert.ok(await page.locator('#ball-joint-apply').isDisabled());assert.equal(await page.locator('[data-ball-joint]').count(),0);await page.locator('#ball-joint-ballDiameter').fill(validDiameter);await ready();
 await page.locator('#ball-joint-slotCount').selectOption('6');await ready();assert.equal((await analysis()).slotCount,6);await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);assert.equal(await page.locator('#bodies [data-ball-joint-id]').count(),3);const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.outputs.length,3);assert.equal(joint.spec.slotCount,6);assert.equal(joint.spec.pose,'assembled');assert.ok(joint.outputs.every(o=>o.brep));await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).outputs.length,3);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-slotCount').inputValue(),'6');assert.equal(await page.locator('#ball-joint-ballDiameter').inputValue(),validDiameter);await page.locator('#ball-joint-neckLength').fill('3');await ready();await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);assert.equal((await save()).features.at(-1).spec.neckLength,3);
 await page.locator('#bodies [data-ball-joint-id]').last().click();await ready();await page.locator('#ball-joint-slotCount').selectOption('4');await close();assert.equal(await page.locator('[data-ball-joint]').count(),0);assert.equal((await save()).features.at(-1).spec.slotCount,6,'cancel during rebuild preserves the original model');
 await load([base]);await page.locator('#ball-joint-tool').click();await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('円柱'));assert.ok(await page.locator('#ball-joint-apply').isDisabled());await close();
 await load([cylinder]);await page.setViewportSize({width:1280,height:900});await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('ballJoint');await ready();assert.ok(await page.locator('#ball-joint-dialog').isVisible());await page.locator('#ball-joint-slotCount').selectOption('6');await close();await page.waitForTimeout(500);assert.equal(await page.locator('[data-ball-joint]').count(),0);assert.equal((await save()).features.length,1);assert.deepEqual(errors,[]);console.log('PASS ball joint three parts, poses, transparency/no rebuild, six slots, invalid recovery, save/reload/edit, undo/redo, cancellation, non-cylinder rejection and small viewport command');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
