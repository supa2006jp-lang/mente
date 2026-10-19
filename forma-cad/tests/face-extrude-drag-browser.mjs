import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1800,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.shortcutJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(p,...args){if(p.spec)window.shortcutJobs.push(p.spec.type);return post.call(this,p,...args);};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),canvas=page.locator('#canvas-host canvas'),shortcut=page.locator('#face-extrude-shortcut'),panel=page.locator('#extrude-distance'),picker=page.locator('#selection-candidates');
 const boxes=[{...defaults,id:'a',kind:'extrusion',name:'左の箱',x:-24,width:20,height:20,depth:10},{...defaults,id:'b',kind:'extrusion',name:'右の箱',x:24,width:20,height:20,depth:10}];
 async function load(features,view='top'){
  await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'shortcut.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(250);
 }
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function ready(count=1){await page.waitForFunction(count=>document.getElementById('canvas-host').dataset.extrusionPreviewCount===String(count)&&!document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',count,{timeout:60000});}
 async function confirm(){await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});}
 function checkSolid(features,id,expectedVolume,maxZ){const bodies=rebuild(features);try{const g=bodies.get(id).geometry;g.computeBoundingBox();assert.ok(Math.abs(volume(g)-expectedVolume)<.05);assert.ok(Math.abs(g.boundingBox.max.z-maxZ)<.001);}finally{for(const body of bodies.values())body.geometry.dispose();}}
 async function selectFace(point,add=false){if(add)await page.keyboard.down('Control');await page.mouse.click(...await screen(point));if(add)await page.keyboard.up('Control');await page.waitForTimeout(150);}

 async function axis(normal){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const a=new THREE.Vector3().project(c),b=new THREE.Vector3(...normal).project(c);let dx=(b.x-a.x)*r.width/2,dy=-(b.y-a.y)*r.height/2;if(Math.hypot(dx,dy)<.1){dx=0;dy=-r.height*c.zoom/200;}return {dx,dy};}
 async function drag(distance,{normal=[0,0,1],release=true}={}){
  const direction=await axis(normal),r=await shortcut.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+direction.dx*distance,y+direction.dy*distance,{steps:8});await panel.waitFor();
  const value=Number(await page.locator('#viewport-depth').inputValue());assert.ok(Math.abs(value-distance)<.08,JSON.stringify({value,distance}));
  assert.equal(await host.getAttribute('data-selected-face-count')==='0'||await shortcut.getAttribute('data-dragging')==='true',true);
  if(release){await page.mouse.up();await shortcut.waitFor({state:'hidden'});assert.equal(await panel.isVisible(),true,'release keeps an uncommitted preview');}
  return {x,y,direction};
 }
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await page.locator('#snap-enabled').uncheck();await selectFace([-22,2,10]);await shortcut.waitFor();
 const r=await shortcut.boundingBox();await page.mouse.move(r.x+17,r.y+17);await page.mouse.down();await page.mouse.move(r.x+18,r.y+16);assert.equal(await panel.isVisible(),false,'small pointer jitter does not start extrusion');await page.mouse.up();await panel.waitFor();await page.locator('#viewport-extrude-cancel').click();
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await selectFace([-22,2,10]);await shortcut.waitFor();const before=JSON.parse(await host.getAttribute('data-camera-state'));await drag(8);assert.equal(await page.locator('#feature-count').textContent(),'2','dragging does not commit a feature');const after=JSON.parse(await host.getAttribute('data-camera-state'));assert.ok(after.slice(3).every((v,i)=>Math.abs(v-before[i+3])<1e-6),'drag does not orbit or zoom');await page.locator('#viewport-depth').fill('8.35');await ready();await page.screenshot({path:'.sites-runtime/face-extrude-drag-preview.png'});await confirm();let data=await save();checkSolid(data.features,'a',7340,18.35);checkSolid(data.features,'b',4000,10);const applied=structuredClone(data.features);await page.keyboard.press('Control+z');assert.equal((await save()).features.length,2);await page.keyboard.press('Control+y');assert.deepEqual((await save()).features,applied);
 // Crossing to the reverse direction retains the existing automatic cut behaviour.
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await selectFace([-22,2,10]);await shortcut.waitFor();await drag(-3.5);assert.equal(await page.locator('#viewport-operation').inputValue(),'cut');await ready();await confirm();data=await save();checkSolid(data.features,'a',2600,6.5);
 // Multiple selected solid faces receive the same drag distance.
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await selectFace([-22,2,10]);await selectFace([26,2,10],true);await shortcut.waitFor();assert.equal(await shortcut.getAttribute('data-count'),'2');await drag(5);await ready(2);await confirm();data=await save();checkSolid(data.features,'a',6000,15);checkSolid(data.features,'b',6000,15);
 // Oblique views use the projected normal; snapping matches the regular arrow.
 const sketch={...defaults,id:'sketch',name:'スケッチ',kind:'sketch',width:20,height:20};await load([sketch],'iso');await page.locator('#selection-mode').selectOption('auto');await page.locator('#snap-enabled').check();await page.locator('#snap-step').selectOption('10');await selectFace([2,2,0]);await shortcut.waitFor();const d=await axis([0,0,1]),bounds=await shortcut.boundingBox(),x=bounds.x+17,y=bounds.y+17;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+d.dx*9.8,y+d.dy*9.8,{steps:8});await panel.waitFor();assert.equal(Number(await page.locator('#viewport-depth').inputValue()),10);assert.equal(await page.locator('#extrude-handle').getAttribute('data-snapped'),'true');await page.mouse.up();await ready();await confirm();data=await save();const newId=data.features.at(-1).id;checkSolid(data.features,newId,4000,10);
 // Escape while captured must release the gesture and keep source geometry.
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await page.locator('#snap-enabled').uncheck();await selectFace([-22,2,10]);await shortcut.waitFor();await drag(6,{release:false});await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await shortcut.evaluate(b=>b.hasPointerCapture(1)),false);await page.mouse.up();assert.equal(await shortcut.getAttribute('data-dragging'),null);assert.deepEqual((await save()).features,boxes);
 // Pointer cancellation ends adjustment without applying or restarting it.
 await load(boxes);await page.locator('#selection-mode').selectOption('face');await selectFace([-22,2,10]);await shortcut.waitFor();await drag(4,{release:false});await shortcut.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.equal(await panel.isVisible(),true);assert.equal(await shortcut.getAttribute('data-dragging'),null);await page.locator('#viewport-extrude-cancel').click();assert.deepEqual((await save()).features,boxes);
 assert.deepEqual(errors,[]);const proof={directDrag:true,clickAndJitter:true,startsAtSurface:true,noAutomaticCommit:true,preciseNumericInput:true,positiveJoin:true,negativeCut:true,multipleFaces:true,sketchProfile:true,projectedAndEndOnNormals:true,gridSnap:true,cameraUnchanged:true,escapeReleasesCapture:true,pointerCancel:true,undoRedo:true,errors};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/face-extrude-drag-browser-proof.json',JSON.stringify(proof,null,2));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
