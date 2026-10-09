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
 const panel=page.locator('#ball-clamp-section-panel'),state=()=>panel.evaluate(el=>JSON.parse(el.dataset.state));
 const camera=()=>page.locator('[data-camera-state]').evaluate(el=>[el.dataset.cameraState,el.dataset.cameraTarget]);
 const before=await camera(),jobs=await page.evaluate(()=>window.cadJobs.length);
 await page.locator('#ball-joint-section').click();await page.waitForFunction(()=>document.getElementById('ball-clamp-section-panel').dataset.sectionReady==='true');
 assert.equal((await state()).advance,0);for(let i=0;i<3;i++)assert.ok((await panel.locator('[data-ball-clamp-part="'+i+'"]').getAttribute('d')).length>100);
 const initial=await panel.locator('[data-ball-clamp-part="2"]').getAttribute('d');
 for(const [key,phase]of [['seat','seat'],['ball','ball'],['end','ball'],['stop','stop']]){await panel.locator('[data-ball-clamp-at="'+key+'"]').click();const s=await state();assert.equal(s.phase,phase);assert.ok(Math.abs(s.rotation-s.advance/4.5*360)<1e-6);if(key==='end')assert.ok(Math.abs(s.remaining-.15)<1e-8);if(key==='stop')assert.equal(s.remaining,0);}
 assert.notEqual(await panel.locator('[data-ball-clamp-part="2"]').getAttribute('d'),initial);assert.ok(await panel.locator('[data-ball-clamp-contact]').count()>0);
 await panel.locator('#ball-clamp-travel').evaluate(el=>{el.value=el.max/2;el.dispatchEvent(new Event('input',{bubbles:true}));});assert.ok((await state()).advance>0);
 await panel.locator('[data-ball-clamp-focus="seat"]').click();await page.screenshot({path:'.sites-runtime/ball-joint-section-seat.png'});await panel.locator('[data-ball-clamp-focus="stop"]').click();await page.screenshot({path:'.sites-runtime/ball-joint-section-stop.png'});
 assert.deepEqual(await camera(),before,'preview controls preserve the CAD camera');assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs,'slider/sections do not regenerate or mutate the model');
 console.log('PASS actual sections, screw travel, contact milestones, physical/safe stop, zooms, no worker jobs or camera changes');
 await panel.locator('#ball-clamp-close').click();assert.ok(await panel.isHidden());await page.locator('#ball-joint-section').click();assert.ok(await panel.isVisible());
 await page.locator('#ball-joint-coneClearance').fill('0.05');await ready();await page.waitForFunction(()=>JSON.parse(document.getElementById('ball-clamp-section-panel').dataset.state).contactTravel<.2);assert.ok((await state()).contactTravel<.2);
 await page.locator('#ball-joint-coneClearance').fill('0.6');await page.waitForFunction(()=>document.getElementById('ball-joint-error').textContent.includes('締め代'));assert.ok(await panel.locator('#ball-clamp-travel').isDisabled());assert.equal(await panel.getAttribute('data-section-ready'),null);assert.equal(await panel.locator('[data-ball-clamp-part]').count(),0);
 await page.locator('#ball-joint-clamp-preset').click();await ready();await panel.locator('[data-ball-clamp-at="stop"]').click();await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);assert.ok(await panel.isHidden());
 const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.pose,'print');assert.ok(!('advance'in joint.spec));assert.ok(!('stopTravel'in joint.spec));assert.equal(joint.spec.coneClearance,.05);
 await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();await page.locator('#ball-joint-section').click();assert.equal((await state()).advance,0);
 await panel.locator('[data-ball-clamp-at="stop"]').click();await close();assert.ok(await panel.isHidden());assert.equal((await save()).features.at(-1).spec.pose,'print');
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.pose,'print');
 console.log('PASS recalculated dimensions, invalidation/recovery, close/reopen/cancel, preview-only state, save and undo/redo');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
