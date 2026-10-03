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
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();


 const host=page.locator('#canvas-host'),fit=page.locator('#fit-selection'),scope=page.locator('#face-grid-scope');
 async function state(){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);return {r,c};}
 async function screen(point){const {r,c}=await state(),q=new THREE.Vector3(...point).project(c);return {x:r.x+(q.x+1)*r.width/2,y:r.y+(1-q.y)*r.height/2};}
 async function load(features){await page.locator('#file').setInputFiles({name:'views.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);}
 async function cursorZoom(){const {r,c}=await state(),pointer={x:r.x+r.width*.63,y:r.y+r.height*.64},target=new THREE.Vector3(...JSON.parse(await host.getAttribute('data-camera-target'))),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(.26,-.28),c);const anchor=ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(c.getWorldDirection(new THREE.Vector3()),target),new THREE.Vector3());await page.mouse.move(pointer.x,pointer.y);await page.mouse.wheel(0,-450);await page.waitForTimeout(150);const after=await screen(anchor.toArray());assert.ok(Math.hypot(after.x-pointer.x,after.y-pointer.y)<.8,'zoom keeps world point under pointer');assert.ok((await state()).c.zoom>c.zoom);}
 const left={...defaults,id:'left',kind:'extrusion',name:'左ボディ',width:60,height:40,depth:20,x:-150},right={...left,id:'right',name:'右ボディ',x:150};
 await load([left,right]);assert.equal(await fit.isDisabled(),true);for(const view of ['top','iso','front']){await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(100);await cursorZoom();}
 await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#bodies [data-body-id=left] .row-label').click();const orientation=(await state()).c.quaternion.toArray();await fit.click();await page.waitForTimeout(100);let data=await state(),center=new THREE.Vector3(-150,0,10).project(data.c);assert.ok(Math.hypot(center.x,center.y)<.001);assert.ok(Math.abs(new THREE.Vector3(150,0,10).project(data.c).x)>1,'fit ignores unselected body');assert.ok(data.c.quaternion.toArray().every((v,i)=>Math.abs(v-orientation[i])<1e-5));assert.equal(await host.getAttribute('data-selected-body-count'),'1');await page.screenshot({path:'.sites-runtime/selection-fit-body.png'});
 await page.locator('#bodies [data-body-id=right] .row-label').click({modifiers:['Control']});await fit.click();await page.waitForTimeout(100);data=await state();assert.equal(await host.getAttribute('data-selected-body-count'),'2');for(const x of [-180,180])for(const y of [-20,20]){const p=new THREE.Vector3(x,y,20).project(data.c);assert.ok(Math.abs(p.x)<=.801&&Math.abs(p.y)<=.801);}
 await page.locator('#selection-mode').selectOption('face');let p=await screen([-150,0,20]);await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.faceGridScope==='face');assert.equal(await scope.isVisible(),true);let bounds=JSON.parse(await host.getAttribute('data-sketch-grid-bounds'));assert.ok(Math.abs(bounds.u[1]-bounds.u[0]-60)<.001);assert.ok(Math.abs(bounds.v[1]-bounds.v[0]-40)<.001);await fit.click();await page.waitForTimeout(100);data=await state();center=new THREE.Vector3(-150,0,20).project(data.c);assert.ok(Math.hypot(center.x,center.y)<.001);assert.equal(await host.getAttribute('data-selected-face-count'),'1');await page.screenshot({path:'.sites-runtime/selection-fit-face-grid.png'});
 await scope.selectOption('200');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.faceGridScope==='200');bounds=JSON.parse(await host.getAttribute('data-sketch-grid-bounds'));assert.deepEqual(bounds,{u:[-250,-50],v:[-100,100]});await cursorZoom();assert.deepEqual(JSON.parse(await host.getAttribute('data-sketch-grid-bounds')),bounds,'200 mm remains fixed while zooming');
 await scope.selectOption('unlimited');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.faceGridScope==='unlimited');assert.notDeepEqual(JSON.parse(await host.getAttribute('data-sketch-grid-bounds')),bounds);await page.screenshot({path:'.sites-runtime/face-grid-unlimited.png'});
 await page.locator('#fit').click();await page.waitForTimeout(100);await page.locator('#selection-mode').selectOption('auto');p=await screen([-150,0,20]);await page.mouse.click(p.x,p.y);await scope.selectOption('face');p=await screen([-150,35,20]);await page.mouse.click(p.x,p.y);assert.equal(await page.locator('#measurement').isVisible(),false,'outside face does not select invisible grid');await scope.selectOption('200');await page.mouse.click(p.x,p.y);assert.match(await page.locator('#measurement-title').textContent(),/面のグリッド/,'inside 200 mm square can select plane');
 await page.locator('#new-line').click();await page.waitForTimeout(100);assert.equal(await page.locator('#face-grid-scope-row').isVisible(),false);await cursorZoom();await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 const ring={...left,id:'ring',x:0,profile:'circle',diameter:60,mode:'thin',wall:5,side:'inside'};await load([ring]);await page.locator('#selection-mode').selectOption('face');p=await screen([27,0,20]);await page.mouse.click(p.x,p.y);await scope.selectOption('face');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.faceGridScope==='face');bounds=JSON.parse(await host.getAttribute('data-sketch-grid-bounds'));assert.ok(Math.abs(bounds.u[1]-bounds.u[0]-60)<.01);await page.screenshot({path:'.sites-runtime/face-grid-ring.png'});assert.deepEqual(errors,[]);await context.close();console.log('PASS cursor-centered zoom in model/view-reset/sketch, selected body/multiple bodies/face fitting, face/200/unlimited grid scopes and grid click bounds'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
