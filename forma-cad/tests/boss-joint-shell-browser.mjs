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
 await load([base]);await page.locator('#boss-joint-tool').click();await ready();assert.equal(await page.locator('#boss-joint-shellEnabled').isChecked(),false);assert.ok(await page.locator('#boss-joint-shellThickness').isDisabled());assert.equal((await analysis()).shell.enabled,false);
 await page.locator('#boss-joint-shellEnabled').check();await ready();let a=await analysis();assert.equal(a.shell.thickness,2);assert.deepEqual(a.shell.parts.map(q=>q.status),['created','created']);assert.equal(a.placements.length,2);assert.ok(a.positions.every(q=>Math.abs(q.bossBase-2)<1e-4&&Math.abs(q.pinBase-28)<1e-4));assert.match(await page.locator('#boss-joint-info').textContent(),/中空化済み/);
 await page.locator('#boss-joint-shellThickness').fill('3');await ready();a=await analysis();assert.equal(a.shell.thickness,3);assert.ok(a.positions.every(q=>Math.abs(q.bossBase-3)<1e-4&&Math.abs(q.pinBase-27)<1e-4));
 await page.locator('#boss-joint-reinforcement').selectOption('ribs');await ready();assert.equal((await analysis()).reinforcement.applied,2);await page.locator('.boss-joint-drag[data-joint-index="0"][data-part="0"]').focus();await page.keyboard.press('ArrowRight');await ready();assert.ok((await analysis()).positions.every(q=>Math.abs(q.uv[0])===12.5));
 await page.screenshot({path:'.sites-runtime/boss-joint-shell-preview.png'});
 await close();assert.equal((await save()).features.length,1,'cancel does not hollow the original');
 await page.locator('#boss-joint-tool').click();await ready();await page.locator('#boss-joint-shellEnabled').check();await ready();await page.locator('#boss-joint-shellThickness').fill('15');await page.waitForFunction(()=>document.querySelector('[data-boss-joint-invalid]'));assert.ok(await page.locator('#boss-joint-apply').isDisabled());assert.match(await page.locator('#boss-joint-error').textContent(),/壁厚/);await page.locator('#boss-joint-shellThickness').fill('2');await ready();
 await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.shellEnabled,true);assert.equal(joint.spec.shellThickness,2);assert.ok(joint.analysis.shell.parts.every(q=>q.status==='created'));await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal((await save()).features.length,2);
 await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.ok(await page.locator('#boss-joint-shellEnabled').isChecked());assert.equal(await page.locator('#boss-joint-shellThickness').inputValue(),'2');await page.locator('#boss-joint-shellEnabled').uncheck();await ready();assert.equal((await analysis()).shell.enabled,false);await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);assert.equal((await save()).features.at(-1).spec.shellEnabled,false);await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.shellEnabled,true);
 await load([base,cavity]);await page.locator('#boss-joint-tool').click();await ready();await page.locator('#boss-joint-shellEnabled').check();await ready();a=await analysis();assert.ok(a.shell.parts.every(q=>q.status==='existing'));assert.match(await page.locator('#boss-joint-info').textContent(),/壁厚を維持/);await close();
 await load([base]);await page.locator('#boss-joint-tool').click();await ready();await page.locator('#boss-joint-shellEnabled').check();await ready();await page.locator('#boss-joint-pose').selectOption('assembled');await ready();assert.equal((await analysis()).placements,undefined);await page.locator('#boss-joint-reinforcement').selectOption('round');await ready();assert.equal((await analysis()).reinforcement.applied,2);await page.screenshot({path:'.sites-runtime/boss-joint-shell-assembled.png'});await close();
 assert.deepEqual(errors,[]);console.log('PASS optional shell default/off, both hollow parts, thickness, reinforcement/position, cancellation, invalid recovery, save/reload/edit, undo/redo and existing hollow preservation');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
