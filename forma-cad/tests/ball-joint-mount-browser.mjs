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
 await load([cylinder]);await page.locator('#ball-joint-tool').click();await ready();
 assert.equal(await page.locator('#ball-joint-mountPitch').inputValue(),'3');assert.match(await page.locator('#ball-joint-mount-pitch-info').textContent(),/M24 × 3 mm/);assert.match(await page.locator('#ball-joint-mount-pitch-info').textContent(),/6.2 mm以上/);assert.equal(await page.locator('#ball-joint-mountThread').isChecked(),false);assert.ok(await page.locator('#ball-joint-mountLength').isDisabled());assert.equal((await analysis()).mountingThreads.length,0);
 await page.locator('#ball-joint-printSafe').uncheck();await page.locator('#ball-joint-mountThread').check();await page.locator('#ball-joint-mountLength').fill('4');await page.locator('#ball-joint-mountPitch').selectOption('1.5');await ready();let a=await analysis();assert.equal(a.mountingThreads.length,2);assert.equal(a.mountingThreads[0].pitch,1.5);assert.equal(await page.locator('#ball-joint-mountPitch').evaluate(el=>el.tagName),'SELECT');assert.equal(a.mountingThreads[0].actualDiameter,23.7);assert.ok(a.overlap.every(v=>v<1e-5));
 await page.locator('#ball-joint-mountThread').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/ball-joint-mount-controls.png'});
 await page.locator('#ball-joint-mountSide').selectOption('ball');await ready();assert.deepEqual((await analysis()).mountingThreads.map(t=>t.role),['ball']);
 await page.locator('#ball-joint-mountSide').selectOption('socket');await ready();assert.deepEqual((await analysis()).mountingThreads.map(t=>t.role),['socket']);
 await page.locator('#ball-joint-mountLength').fill('20');await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('土台が短すぎ'));assert.ok(await page.locator('#ball-joint-apply').isDisabled());assert.equal(await page.locator('[data-ball-joint]').count(),0);
 await page.locator('#ball-joint-mountLength').fill('4');await page.locator('#ball-joint-mountSide').selectOption('both');await ready();
 await page.locator('#ball-joint-pose').selectOption('assembled');await ready();await page.locator('#ball-joint-transparent').check();assert.equal((await analysis()).mountingThreads.length,2);
 await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);let saved=await save();const joint=saved.features.at(-1);assert.equal(joint.spec.mountThread,true);assert.equal(joint.spec.mountSide,'both');assert.equal(joint.spec.mountLength,4);assert.equal(joint.spec.mountClearance,.15);assert.equal(joint.outputs.length,3);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.mountThread,true);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-mountThread').isChecked(),true);assert.equal(await page.locator('#ball-joint-mountLength').inputValue(),'4');assert.equal((await analysis()).mountingThreads.length,2);
 await page.locator('#ball-joint-mountThread').uncheck();await ready();assert.equal((await analysis()).mountingThreads.length,0);assert.ok(await page.locator('#ball-joint-mountPitch').isDisabled());await close();assert.equal((await save()).features.at(-1).spec.mountThread,true,'cancel retains saved threads');
 // Re-edit a legacy feature whose spec has none of the new fields.
 const legacy=structuredClone(saved.features);for(const key of ['mountThread','mountSide','mountPitch','mountLength','mountClearance'])delete legacy.at(-1).spec[key];await load(legacy);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();assert.equal(await page.locator('#ball-joint-mountThread').isChecked(),false);assert.equal((await analysis()).mountingThreads.length,0);await close();
 await load([cylinder]);await page.setViewportSize({width:1280,height:900});await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('ballJoint');await ready();await page.locator('#ball-joint-mountThread').check();await close();await page.waitForTimeout(500);assert.equal(await page.locator('[data-ball-joint]').count(),0);assert.equal((await save()).features.length,1);assert.deepEqual(errors,[]);
 const mountingOptions=await page.locator('#ball-joint-mountPitch option').evaluateAll(items=>items.map(o=>o.value));
 await page.evaluate(async()=>{const {renderThreadDialog}=await import('/mente/forma-cad/src/thread-dialog.js');renderThreadDialog({radius:12,internal:true});});
 assert.equal(await page.locator('#thread-designation').inputValue(),'3');
 assert.deepEqual(await page.locator('#thread-designation option').evaluateAll(items=>items.map(o=>o.value)),mountingOptions);
 console.log('PASS common normal/mount pitch defaults and options, explicit length requirements; mounting thread optional/targets, nominal diameter and gap, invalid recovery, save/reload/reedit, undo/redo, cancellation, legacy opt-out and small viewport');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
