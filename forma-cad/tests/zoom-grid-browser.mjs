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

 const host=page.locator('#canvas-host');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:20,height:20,depth:20};
 await page.locator('#file').setInputFiles({name:'zoom.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box]}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').click();
 async function state(){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);return {r,c};}
 async function verify(plane,working=false){const {c}=await state(),basis={XY:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},XZ:{u:[1,0,0],v:[0,0,-1],n:[0,1,0]},YZ:{u:[0,0,-1],v:[0,1,0],n:[1,0,0]}}[plane],b=Object.fromEntries(Object.entries(basis).map(([k,v])=>[k,new THREE.Vector3(...v)])),bounds=JSON.parse(await host.getAttribute(working?'data-sketch-grid-bounds':'data-grid-bounds')),step=Number(await host.getAttribute(working?'data-sketch-grid-display-step':'data-grid-display-step')),ray=new THREE.Raycaster();assert.equal(await host.getAttribute('data-grid-step'),'10','snap spacing does not change');assert.ok(step>=10);
  for(const x of [-.96,.96])for(const y of [-.96,.96]){ray.setFromCamera(new THREE.Vector2(x,y),c);const hit=ray.ray.intersectPlane(new THREE.Plane(b.n,0),new THREE.Vector3());assert.ok(hit,'visible grid plane remains in front of camera');for(const k of ['u','v'])assert.ok(hit.dot(b[k])>=bounds[k][0]&&hit.dot(b[k])<=bounds[k][1],plane+' grid covers viewport');const z=hit.clone().project(c).z;assert.ok(z>-1&&z<1,'grid is inside depth clipping range');}
 }
 const {r}=await state();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
 for(let i=0;i<3;i++){await page.mouse.wheel(0,1500);await page.waitForTimeout(120);await verify('XY');}await page.screenshot({path:'.sites-runtime/zoom-grid-model.png'});
 await page.locator('#selection-mode').selectOption('body');let current=await state(),q=new THREE.Vector3(0,0,10).project(current.c);await page.mouse.click(current.r.x+(q.x+1)*current.r.width/2,current.r.y+(1-q.y)*current.r.height/2);assert.equal(await host.getAttribute('data-selected-body-count'),'1','body remains pickable after camera depth adjustment');await page.keyboard.press('Escape');
 for(let i=0;i<3;i++){await page.mouse.wheel(0,1500);await page.waitForTimeout(120);await verify('XY');}
 for(const plane of ['XZ','YZ','XY']){await page.locator('#reference-plane').selectOption(plane);await page.waitForTimeout(120);await verify(plane);}
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down({button:'right'});await page.mouse.move(r.x+r.width/2+180,r.y+r.height/2+90,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(350);await verify('XY');await page.screenshot({path:'.sites-runtime/zoom-grid-panned.png'});
 await page.locator('#fit').click();await page.locator('#new-line').click();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);for(let i=0;i<4;i++){await page.mouse.wheel(0,1500);await page.waitForTimeout(120);await verify('XY',true);}await page.screenshot({path:'.sites-runtime/zoom-grid-sketch.png'});
 await page.setViewportSize({width:1050,height:650});await page.waitForTimeout(150);await verify('XY',true);assert.deepEqual(errors,[]);await context.close();console.log('PASS zoomed/panned XY/XZ/YZ grids cover viewport, camera clipping, unchanged snapping, body picking, sketch grid and viewport resize'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
