import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateFeature} from '../src/geometry.js';
import {mirrorSketch} from '../src/sketch-mirror.js';
import {sketchPoints,planeCoordinates} from '../src/regions.js';
import {worldPoint,basisFor} from '../src/frames.js';
import {mirrorGridPlane} from '../src/mirror-grid-axis.js';
import {selectedSketchParts,sketchSegments} from '../src/sketch-selection.js';

const root=path.resolve('.'),prefix='/mente/forma-cad/',types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!url.startsWith(prefix))throw Error();let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);
 const host=page.locator('#canvas-host');
 async function screen(w){const r=await page.locator('#canvas-host canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=w.clone().project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));}
 async function load(features,edit=true){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'mirror.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});if(edit)await page.locator('[data-sketch-group] .row-label').first().click();await page.waitForTimeout(150);}
 async function mirror(){await page.locator('#sketch-mirror-tool').click();await page.waitForFunction(()=>document.getElementById('tools-dialog').open);}
 async function apply(){await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);await page.waitForTimeout(100);assert.equal(await host.getAttribute('data-sketch-mirror-preview'),null);}
 async function cameraUnchanged(before){const after=JSON.parse(await host.getAttribute('data-camera-state'));JSON.parse(before).forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-7,'mirror keeps the camera'));}

 const base={...defaults,kind:'sketch',groupId:'g',groupNumber:1,groupHidden:false},rect={...base,id:'rect',name:'長方形',profile:'rect',width:12,height:8,x:24,y:8,z:0};
 const world=f=>sketchPoints(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));
 async function choosePoints(){await mirror();await page.locator('#cad-plane').selectOption('POINTS');assert.equal(await page.locator('#mirror-grid-axis-controls').isVisible(),true);assert.equal(await page.locator('#cad-apply').isDisabled(),true);}
 async function clickPoint(p,dx=0,dy=0){const [x,y]=await screen(p);await page.mouse.click(x+dx,y+dy);}
 async function ready(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.mirrorGridPoints==='2'&&document.getElementById('canvas-host').dataset.sketchMirrorPreview==='1');assert.equal(await page.locator('#cad-apply').isEnabled(),true);}
 await load([rect]);const initial=(await save()).features,view=await host.getAttribute('data-camera-state');await choosePoints();
 await clickPoint(new THREE.Vector3(20,10,0),3,2);assert.equal(await host.getAttribute('data-mirror-grid-points'),'1');assert.match(await page.locator('#mirror-grid-axis-status').textContent(),/1点目：20, 10, 0/);
 await clickPoint(new THREE.Vector3(20,10,0));assert.equal(await host.getAttribute('data-mirror-grid-points'),'1');assert.match(await page.locator('#mirror-grid-axis-status').textContent(),/異なる/);assert.equal(await page.locator('#cad-apply').isDisabled(),true);
 await page.mouse.move(...await screen(new THREE.Vector3(20,15,0)));await page.screenshot({path:'.sites-runtime/mirror-grid-axis-picking.png'});await clickPoint(new THREE.Vector3(20,15,0));await ready();await cameraUnchanged(view);
 await page.locator('#mirror-grid-axis-reset').click();assert.equal(await host.getAttribute('data-mirror-grid-points'),'0');assert.equal(await page.locator('#cad-apply').isDisabled(),true);await clickPoint(new THREE.Vector3(20,10,0));await clickPoint(new THREE.Vector3(20,15,0));await ready();await page.locator('#cad-offset').fill('2');await ready();await apply();let data=await save();assert.equal(data.features.length,2);const expected=mirrorSketch(rect,{mirrorNormal:[1,0,0],mirrorOrigin:[22,0,0]});for(const p of world(expected))assert.ok(world(data.features[1]).some(q=>q.distanceTo(p)<1e-6));await cameraUnchanged(view);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).features,initial);await page.keyboard.press('Control+y');const saved=(await save()).features;await load(saved);assert.deepEqual((await save()).features,saved);
 await load([rect]);await choosePoints();await clickPoint(new THREE.Vector3(0,0,0));await page.locator('#cad-cancel').click();assert.equal(await host.getAttribute('data-mirror-grid-points'),null);assert.deepEqual((await save()).features,initial);await mirror();assert.equal(await page.locator('#cad-apply').isEnabled(),true);await page.locator('#cad-cancel').click();
 // A tilted, offset sketch frame is projected in world space without changing the view.
 const h=Math.SQRT1_2,frame={u:[h,0,-h],v:[0,1,0],n:[h,0,h]},custom={...rect,plane:'CUSTOM',frame,x:32*h,y:8,z:-16*h},at=(u,v)=>worldPoint({plane:'CUSTOM',frame,offset:8},[u,v]);await load([custom]);const customView=await host.getAttribute('data-camera-state');await choosePoints();await clickPoint(at(20,10));await clickPoint(at(30,10));await ready();await apply();data=await save();const customSpec=mirrorGridPlane([at(20,10),at(30,10)],basisFor(custom).n),reflected=mirrorSketch(custom,customSpec);for(const p of world(reflected))assert.ok(world(data.features[1]).some(q=>q.distanceTo(p)<1e-6));await cameraUnchanged(customView);
 // A body uses the current reference grid; no construction sketch is added.
 const body={...defaults,id:'body',name:'箱',width:12,height:8,depth:5,x:24,y:0,z:0};await load([body],false);await choosePoints();await clickPoint(new THREE.Vector3(20,0,0));await clickPoint(new THREE.Vector3(20,10,0));assert.equal(await host.getAttribute('data-mirror-grid-points'),'2');await apply();data=await save();assert.equal(data.features.length,2);assert.equal(data.features[1].kind,'cadop');assert.ok(Math.abs(data.features[1].spec.mirrorNormal[0])>.999999);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual(data.features[1].spec.mirrorOrigin,[20,0,0]);assert.deepEqual(errors,[]);
 await load([body],false);await clickPoint(new THREE.Vector3(24,0,5));await mirror();assert.equal(await page.locator('#cad-plane').inputValue(),'FACE');await page.locator('#cad-plane').selectOption('POINTS');await clickPoint(new THREE.Vector3(20,-2,5));await clickPoint(new THREE.Vector3(20,2,5));assert.equal(await host.getAttribute('data-mirror-grid-points'),'2');await apply();data=await save();assert.ok(Math.abs(data.features[1].spec.mirrorOrigin[2]-5)<1e-6,'purple face grid retains its height');assert.ok(Math.abs(data.features[1].spec.mirrorNormal[0])>.999999);assert.deepEqual(errors,[]);
 console.log('PASS grid two-point mirror: intersection snap, first/second point, degenerate rejection, reset/cancel, unchanged view, offset, exact custom-frame reflection, undo/redo/save and solid mirror without a helper sketch');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
