import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
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
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){const op=m.spec?.type==='preview'?m.spec.operation:m.spec;if(window.forceCadError&&['fillet','shell'].includes(op?.type)){const error=window.forceCadError;setTimeout(()=>this.onmessage?.({data:{id:m.id,error}}),5);return;}return post.call(this,m,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),picker=page.locator('#selection-candidates');
 const back={...defaults,id:'back',name:'奥の本体',kind:'extrusion',width:40,height:30,depth:10,z:0},front={...back,id:'front',name:'手前の本体',z:20};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'overlap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}


 const persistent=page.locator('#selected-point-marker'),measure=page.locator('#point-distance'),overlay=page.locator('#point-distance-overlay');
 async function selectPoint(kind,body='back',last=false){
  await page.locator('#selection-mode').selectOption(kind==='faceCenter'?'face':'auto');await page.mouse.click(...await screen(kind==='faceCenter'?[8,6,30]:[19.8,5,30]));await picker.waitFor();
  const choices=picker.locator('[data-kind='+kind+'][data-body-id='+body+']');await (last?choices.last():choices.first()).click();await persistent.waitFor();await picker.locator('[data-close]').click();await page.mouse.move(30,30);await page.waitForTimeout(80);
 }
 const measurement=async()=>JSON.parse(await host.getAttribute('data-point-distance'));
 async function projectedLine(){const state=await measurement(),a=await screen(state.a),b=await screen(state.b),v=await page.locator('.viewport').boundingBox(),line=overlay.locator('line').first();for(const [name,want]of [['x1',a[0]-v.x],['y1',a[1]-v.y],['x2',b[0]-v.x],['y2',b[1]-v.y]])assert.ok(Math.abs(Number(await line.getAttribute(name))-want)<2,'measurement line follows camera and canvas');}
 await load([back,front]);const original=(await save()).features;
 await selectPoint('faceCenter');assert.match(await page.locator('#measurement-title').textContent(),/奥の本体.*上面の中心/);assert.match(await persistent.getAttribute('aria-label'),/奥の本体.*上面の中心.*クリック/);
 // A canceled move retains the point. Pointer and keyboard activation restore its actions.
 await page.locator('#point-rotate').click();await page.locator('#move-panel').waitFor();await page.locator('#move-cancel').click();await persistent.waitFor();assert.equal(await page.locator('#measurement').isVisible(),false);await persistent.click();await page.locator('#point-rotate').waitFor();assert.deepEqual(JSON.parse(await host.getAttribute('data-selected-point')).point,[0,0,10]);assert.match(await page.locator('#measurement-title').textContent(),/奥の本体/);await page.locator('#point-to-origin').click();assert.deepEqual(JSON.parse(await host.getAttribute('data-move-preview')).pivot,[0,0,10]);await page.locator('#move-cancel').click();await persistent.waitFor();await persistent.focus();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.activeElement.id),'selected-point-marker');await page.keyboard.press('Enter');await page.locator('#point-measure').waitFor();assert.deepEqual((await save()).features,original);
 // A center and midpoint on two bodies form a 3D measurement with signed components.
 await page.locator('#point-measure').click();await measure.waitFor();assert.equal((await measurement()).b,null);assert.match(await measure.locator('[data-a]').textContent(),/奥の本体.*上面の中心/);await selectPoint('midpoint','front');const state=await measurement();assert.deepEqual(state.a,[0,0,10]);assert.deepEqual(state.b,[20,0,30]);assert.deepEqual(state.delta,[20,0,20]);assert.ok(Math.abs(state.distance-Math.sqrt(800))<1e-8);assert.equal(await measure.locator('[data-distance]').textContent(),'28.28 mm');assert.equal(await measure.locator('[data-delta]').textContent(),'ΔX +20.00 / ΔY 0.00 / ΔZ +20.00 mm');assert.match(await measure.locator('[data-b]').textContent(),/手前の本体.*辺の中点/);await overlay.waitFor();await projectedLine();await page.locator('[data-view=iso]').click();await page.waitForTimeout(150);await projectedLine();await page.screenshot({path:'.sites-runtime/point-distance.png'});assert.deepEqual((await save()).features,original,'measurement is read-only');assert.equal(await page.evaluate(()=>window.cadJobs.length),0,'no geometry calculation is required for measurements');
 // The pinned A survives another B, including a negative height difference.
 await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(100);await selectPoint('faceCenter','back',true);assert.deepEqual((await measurement()).a,[0,0,10]);assert.deepEqual((await measurement()).delta,[0,0,-10]);assert.equal(await measure.locator('[data-distance]').textContent(),'10.00 mm');assert.match(await measure.locator('[data-delta]').textContent(),/ΔZ -10.00/);await measure.locator('[data-again]').click();assert.equal((await measurement()).b,null);assert.equal(await overlay.locator('line').first().evaluate(e=>getComputedStyle(e).display),'none');await selectPoint('midpoint','front');
 // Compact views retain accessible measurement controls and correctly clipped projection.
 await page.setViewportSize({width:1000,height:760});await page.locator('#fit').click();await page.waitForTimeout(150);await projectedLine();const panel=await page.locator('#measurement').boundingBox(),viewport=await page.locator('.viewport').boundingBox();assert.ok(panel.y>=viewport.y-1&&panel.y+panel.height<=viewport.y+viewport.height+1);await page.screenshot({path:'.sites-runtime/point-distance-compact.png'});await measure.locator('[data-clear]').click();await measure.waitFor({state:'hidden'});await overlay.waitFor({state:'hidden'});assert.equal(await host.getAttribute('data-point-distance'),null);await persistent.click();await page.locator('#point-measure').click();await page.keyboard.press('Escape');await overlay.waitFor({state:'hidden'});await persistent.waitFor({state:'hidden'});assert.equal(await host.getAttribute('data-point-distance'),null);
 // Hiding the reference body invalidates the measurement instead of leaving a stale line.
 await page.setViewportSize({width:1900,height:1150});await load([back,front]);await selectPoint('faceCenter');await page.locator('#point-measure').click();await selectPoint('midpoint','front');await page.locator('#bodies .eye').first().click();await overlay.waitFor({state:'hidden'});assert.equal(await host.getAttribute('data-point-distance'),null);await page.locator('#bodies .eye').first().click();assert.deepEqual((await save()).features,original);assert.deepEqual(errors,[]);
 console.log('PASS body-specific point labels, pointer/keyboard resume after cancellation, 3D center-to-midpoint distance, signed XYZ, repeat B, read-only model, camera/compact projection, clear/Esc and hidden-source invalidation');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
