import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateFeature} from '../src/geometry.js';
import {mirrorSketch} from '../src/sketch-mirror.js';
import {sketchPoints,planeCoordinates} from '../src/regions.js';
import {worldPoint} from '../src/frames.js';
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
 async function screen(w){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=w.clone().project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));}
 async function load(features,edit=true){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'mirror.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});if(edit)await page.locator('[data-sketch-group] .row-label').first().click();await page.waitForTimeout(150);}
 async function mirror(){await page.locator('#sketch-mirror-tool').click();await page.waitForFunction(()=>document.getElementById('tools-dialog').open);}
 async function apply(){await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open);await page.waitForTimeout(100);assert.equal(await host.getAttribute('data-sketch-mirror-preview'),null);}
 async function cameraUnchanged(before){const after=JSON.parse(await host.getAttribute('data-camera-state'));JSON.parse(before).forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-7,'mirror keeps the camera'));}
 const base={...defaults,kind:'sketch',groupId:'g',groupNumber:1,groupHidden:false};
 const rect={...base,id:'rect',name:'長方形',profile:'rect',width:16,height:12,x:24,y:8,z:0,angle:13};
 const curve={...base,id:'spline',name:'曲線',profile:'spline',points:[[10,-12],[20,-3],[35,-10]],closed:false,tangents:{start:37,end:-68},tangentLengths:{start:4,end:7}};
 const axis={...base,id:'axis',name:'斜めの基準線',profile:'line',mode:'thin',width:80,x:0,y:0,z:0,angle:30};
 const originals=[rect,curve,axis];await load(originals);const initial=(await save()).features;
 await mirror();assert.equal(await page.locator('#cad-target').inputValue(),'rect');assert.equal(await page.locator('#cad-plane').inputValue(),'V');assert.equal(await host.getAttribute('data-sketch-mirror-preview'),'1');
 await page.locator('#cad-target').selectOption('sketch-group:g');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchMirrorPreview==='3');
 await page.locator('#cad-offset').fill('3');const before=await host.getAttribute('data-camera-state');await page.screenshot({path:'.sites-runtime/sketch-mirror-preview.png'});await page.locator('#cad-cancel').click();assert.deepEqual((await save()).features,initial,'preview/cancel does not change sketches');assert.equal(await host.getAttribute('data-sketch-mirror-preview'),null);await cameraUnchanged(before);
 await mirror();await page.locator('#cad-target').selectOption('sketch-group:g');await page.locator('#cad-offset').fill('3');await apply();let project=await save();assert.equal(project.features.length,6);assert.deepEqual(project.features.slice(0,3),initial);await cameraUnchanged(before);
 const world=f=>sketchPoints(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));
 for(let i=0;i<3;i++){const expected=mirrorSketch(initial[i],{plane:'V',offset:3}),copy=project.features[i+3];validateFeature(copy);for(const p of world(expected))assert.ok(world(copy).some(q=>q.distanceTo(p)<1e-7));assert.equal(copy.groupId,'g');}
 assert.deepEqual(project.features[4].tangents,{start:-37,end:68});assert.deepEqual(project.features[4].tangentLengths,curve.tangentLengths);
 const mirrored=structuredClone(project.features);await page.keyboard.press('Control+z');assert.deepEqual((await save()).features,initial,'whole group mirror is one undo step');await page.keyboard.press('Control+y');assert.deepEqual((await save()).features,mirrored);await load(mirrored);assert.deepEqual((await save()).features,mirrored,'save/reload preserves mirror');
 // Named arbitrary line, with a tilted custom sketch plane and unchanged view.
 const s=Math.SQRT1_2,frame={u:[s,0,-s],v:[0,1,0],n:[s,0,s]},custom=[curve,axis].map(f=>({...f,plane:'CUSTOM',frame,x:8*s,y:0,z:8*s}));
 await load(custom);await mirror();await page.locator('#cad-target').selectOption('spline');await page.locator('#cad-plane').selectOption('LINE');assert.equal(await page.locator('#sketch-mirror-axis').isVisible(),true);await page.locator('#sketch-mirror-axis').selectOption(JSON.stringify(['axis',0]));const referenceEdge=sketchSegments(custom[1])[0];await page.mouse.click(...await screen(referenceEdge.a.clone().lerp(referenceEdge.b,.8)));assert.equal(await page.locator('#sketch-mirror-axis').inputValue(),'','canvas reference overrides a named axis');await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchMirrorPreview==='1');const customView=await host.getAttribute('data-camera-state');await apply();project=await save();assert.equal(project.features.length,3);const direction=new THREE.Vector3(...frame.u).multiplyScalar(Math.cos(Math.PI/6)).addScaledVector(new THREE.Vector3(...frame.v),Math.sin(Math.PI/6)),normal=direction.cross(new THREE.Vector3(...frame.n)).normalize(),expected=mirrorSketch(custom[0],{mirrorNormal:normal.toArray(),mirrorOrigin:[8*s,0,8*s]});for(const p of world(expected))assert.ok(world(project.features[2]).some(q=>q.distanceTo(p)<1e-7));await cameraUnchanged(customView);await load(project.features);assert.equal((await save()).features.length,3);
 // Partial rectangle selection mirrors exactly those two edges, as one undoable action.
 await load([rect]);await page.locator('#select-sketch-edge').click();const edges=sketchSegments(rect);
 await page.mouse.click(...await screen(edges[0].a.clone().add(edges[0].b).multiplyScalar(.5)));await page.keyboard.down('Control');await page.mouse.click(...await screen(edges[1].a.clone().add(edges[1].b).multiplyScalar(.5)));await page.keyboard.up('Control');assert.equal(await host.getAttribute('data-selected-sketch-count'),'2');
 await mirror();assert.equal(await page.locator('#cad-target').inputValue(),'sketch-selection');await page.locator('#cad-plane').selectOption('U');await page.locator('#cad-offset').fill('-5');await apply();project=await save();assert.equal(project.features.length,2);assert.equal(project.features[1].profile,'polyline');assert.equal(sketchSegments(project.features[1]).length,2);const selectedCopy=mirrorSketch(selectedSketchParts(rect,new Set([0,1]))[0],{plane:'U',offset:-5});for(const p of world(selectedCopy))assert.ok(world(project.features[1]).some(q=>q.distanceTo(p)<1e-7));await page.keyboard.press('Control+z');assert.equal((await save()).features.length,1);
 // Existing solid mirroring still uses a world plane and the CAD kernel.
 await load([{...defaults,id:'body',name:'箱',width:20,height:15,depth:8}],false);await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('mirror');await page.locator('#cad-plane').selectOption('YZ');assert.equal(await page.locator('#cad-plane option[value=V]').evaluate(el=>el.disabled),true,JSON.stringify(await page.locator('#cad-target').evaluate(el=>({value:el.value,options:[...el.options].map(o=>[o.value,o.text])}))));await page.locator('#cad-offset').fill('30');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:90000});assert.equal(await page.locator('#body-count').textContent(),'2');
 assert.deepEqual(errors,[]);console.log('PASS sketch mirror toolbar, preview/cancel, whole group, spline controls, undo/redo, save/reload, custom-plane line reference, unchanged camera and solid regression');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
