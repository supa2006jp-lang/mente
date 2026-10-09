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
 async function load(features){await page.locator('#file').setInputFiles({name:'reinforcement.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('boss-joint-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#boss-joint-error').textContent());}}
 async function analysis(){return page.locator('[data-boss-joint]').evaluate(el=>JSON.parse(el.dataset.bossJoint));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 const handle=(index,part=0)=>page.locator('.boss-joint-drag[data-joint-index="'+index+'"][data-part="'+part+'"]');
 async function drag(index,part,dx,dy){const b=await handle(index,part).boundingBox();assert.ok(b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:5});await page.mouse.up();}
 await load([base,cavity]);await page.locator('#boss-joint-tool').click();await ready();assert.equal(await page.locator('.boss-joint-drag').count(),4);assert.ok(await page.locator('#boss-joint-reinforcementSize').isDisabled());await page.locator('#boss-joint-reinforcement').selectOption('round');await ready();let a=await analysis();assert.equal(a.reinforcement.type,'round');assert.equal(a.reinforcement.applied,2);await page.screenshot({path:'.sites-runtime/boss-joint-round-preview.png'});
 await page.locator('#boss-joint-reinforcement').selectOption('ribs');await ready();a=await analysis();assert.equal(a.reinforcement.type,'ribs');assert.ok(a.positions.every(q=>q.reinforcement.boss>0&&q.reinforcement.pin>0));await page.screenshot({path:'.sites-runtime/boss-joint-ribs-preview.png'});
 const before=a.positions.map(q=>q.uv);await drag(0,0,24,-14);await ready();a=await analysis();assert.notDeepEqual(a.positions.map(q=>q.uv),before);assert.ok(Math.abs(a.positions[0].uv[0]+a.positions[1].uv[0])<1e-6);assert.equal(a.positions[0].uv[1],a.positions[1].uv[1]);assert.equal(a.overlap,0);
 let current=a.positions.map(q=>q.uv);const b=await handle(0).boundingBox();await page.mouse.move(b.x+15,b.y+15);await page.mouse.down();await page.mouse.move(b.x+45,b.y+30);await page.keyboard.press('Escape');await page.mouse.up();assert.ok(await page.locator('#boss-joint-dialog').isVisible());assert.deepEqual((await analysis()).positions.map(q=>q.uv),current);await ready();
 await handle(0).focus();await page.keyboard.press('ArrowRight');await ready();a=await analysis();assert.equal(a.positions[0].uv[0],Number((current[0][0]+1).toFixed(4)));assert.ok(Math.abs(a.positions[0].uv[0]+a.positions[1].uv[0])<1e-6);
 await page.locator('#boss-joint-symmetric').uncheck();await ready();current=(await analysis()).positions.map(q=>q.uv);await drag(1,1,16,9);await ready();a=await analysis();assert.deepEqual(a.positions[0].uv,current[0]);assert.notDeepEqual(a.positions[1].uv,current[1]);
 await drag(0,0,-700,0);await page.waitForFunction(()=>document.querySelector('[data-boss-joint-invalid]'));assert.ok(await page.locator('#boss-joint-apply').isDisabled());assert.ok(await handle(0).isVisible(),'invalid placement leaves the handle available to recover');await page.locator('#boss-joint-auto-layout').click();await ready();
 await page.locator('#boss-joint-count').selectOption('4');await ready();await page.locator('#boss-joint-symmetric').check();await ready();await drag(0,0,8,-6);await ready();a=await analysis();assert.equal(a.positions.length,4);const points=a.positions.map(q=>q.uv),center=a.layout.center;for(const point of points){assert.ok(points.some(q=>Math.abs(q[0]-(2*center[0]-point[0]))<1e-5&&Math.abs(q[1]-point[1])<1e-5));assert.ok(points.some(q=>Math.abs(q[1]-(2*center[1]-point[1]))<1e-5&&Math.abs(q[0]-point[0])<1e-5));}await page.screenshot({path:'.sites-runtime/boss-joint-drag-preview.png'});
 await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.reinforcement,'ribs');assert.equal(joint.spec.symmetricPlacement,true);assert.deepEqual(joint.spec.jointPositions,joint.analysis.positions.map(q=>q.uv));assert.equal(await page.locator('.boss-joint-drag').count(),0);await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.length,3);
 await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();assert.equal(await page.locator('#boss-joint-reinforcement').inputValue(),'ribs');assert.deepEqual((await analysis()).positions.map(q=>q.uv),joint.spec.jointPositions);await page.locator('#boss-joint-cancel').click();
 await load([base,cavity]);await page.locator('#boss-joint-tool').click();await ready();await page.locator('#boss-joint-count').selectOption('1');await ready();await page.locator('#boss-joint-offsetU').fill('23.5');await ready();assert.match(await page.locator('#boss-joint-warning').textContent(),/壁・外周/);await page.locator('#boss-joint-cancel').click();assert.deepEqual(errors,[]);console.log('PASS reinforcement options, boss/pin dragging, symmetry, individual moves, keyboard, Esc, invalid/recovery, near-wall warning, save/reload and undo/redo');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
