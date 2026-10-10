import * as THREE from 'three';
import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {featureSolid} from '../src/kernel.js';
import {bodyEdges} from '../src/body-edges.js';
import {defaults,rebuild} from '../src/geometry.js';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
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
 const context=await browser.newContext({viewport:{width:1700,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.holeJobs=[];const send=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec?.type==='extrusionBatch'&&payload.spec.features[0]?.hole){window.holeJobs.push(payload.spec);if(window.holeResponse==='error'){setTimeout(()=>this.onmessage?.({data:{id:payload.id,error:'穴あけテストで失敗'}}),10);return;}if(window.holeResponse==='hold'){window.releaseHole=()=>send.call(this,payload,...args);return;}}return send.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const host=page.locator('#canvas-host');
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'hole-exact.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}

 const box={...defaults,id:'b',name:'body',kind:'extrusion',width:60,height:60,depth:20,x:30,y:30,taperAngle:-10};
 async function drill(point,{diameter=40,depth=8.86,through=false}={}){
  await page.locator('#cut-tool').click();await page.mouse.click(...await screen(point));assert.ok(await page.locator('#hole-apply').isEnabled());
  await page.locator('#hole-diameter').fill(String(diameter));await page.locator('#hole-through').setChecked(through);
  if(!through)await page.locator('#hole-depth').fill(String(depth));
  await page.locator('#hole-apply').click();
  await page.locator('#hole-panel').waitFor({state:'hidden'});
  return (await save()).features;
 }
 await load([box]);
 const before=JSON.parse(await host.getAttribute('data-camera-state'));
 const blind=await drill([30,30,20]);
 const hole=blind.at(-1);assert.ok(hole.hole&&hole.cadResult?.outputs[0].brep,'Hole must be calculated by CAD and persist exact geometry');
 assert.ok(hole.cadResult.outputs[0].faceGroups.length,'CAD face groups prevent internal tessellation edges');
 const bodies=rebuild(blind),geometry=bodies.get('b').geometry;
 const sourceSolid=featureSolid(box),drilled=R.deserializeShape(hole.cadResult.outputs[0].brep).asShape3D();
 assert.ok(Math.abs(R.measureVolume(sourceSolid)-R.measureVolume(drilled)-Math.PI*400*8.86)<.01);sourceSolid.delete();drilled.delete();
 const outline=bodyEdges(geometry),edges=outline.attributes.position;for(let i=0;i<edges.count;i+=2){const x=(edges.getX(i)+edges.getX(i+1))/2-30,y=(edges.getY(i)+edges.getY(i+1))/2-30;assert.ok(Math.hypot(x,y)>19.8,'No spurious edges cross the circular floor');}
 outline.dispose();for(const b of bodies.values())b.geometry.dispose();
 await fs.writeFile('.sites-runtime/hole-exact-blind.json',JSON.stringify({format:'forma-cad',version:1,features:blind}));
 assert.deepEqual(JSON.parse(await host.getAttribute('data-camera-state')),before,'Hole keeps the view');
 await page.locator('[data-view=iso]').click();await page.locator('#fit').click();await page.screenshot({path:'.sites-runtime/hole-exact-blind.png'});
 const afterCount=blind.length;await page.locator('#undo').click();assert.equal(Number(await page.locator('#feature-count').textContent()),afterCount-1);await page.locator('#redo').click();assert.deepEqual((await save()).features,blind);
 await load(blind);assert.ok((await save()).features.at(-1).cadResult,'Save/reload retains exact geometry');
 // A second hole works against the previously drilled CAD body.
 await page.locator('#snap-enabled').uncheck();
 const twice=await drill([8,30,20],{diameter:3,depth:4});assert.ok(twice.at(-1).cadResult);
 await load([{...box,depth:32.6,taperAngle:0}]);
 const through=await drill([30,30,32.6],{diameter:40,through:true});
 await fs.writeFile('.sites-runtime/hole-exact-through.json',JSON.stringify({format:'forma-cad',version:1,features:through}));
 assert.ok(through.at(-1).cadResult);
 const throughBodies=rebuild(through),mesh=new THREE.Mesh(throughBodies.get('b').geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
 assert.equal(new THREE.Raycaster(new THREE.Vector3(30,30,40),new THREE.Vector3(0,0,-1),0,50).intersectObject(mesh).length,0,'Through hole contains no floating faces or caps');mesh.material.dispose();for(const b of throughBodies.values())b.geometry.dispose();
 // Re-editing a hole from older files upgrades it to exact CAD without losing entry clearance.
 const legacy={...hole,id:'legacy',name:'legacy hole'};delete legacy.cadResult;
 await load([box,legacy]);await page.locator('#features .row-label').filter({hasText:'legacy hole'}).click();
 await page.locator('#viewport-depth').fill('-9');await page.waitForFunction(()=>!document.querySelector('#extrude-distance button[type=submit]').disabled);
 await page.locator('#extrude-distance button[type=submit]').click();await page.locator('#extrude-distance').waitFor({state:'hidden'});
 const repaired=(await save()).features.at(-1);assert.ok(repaired.hole&&repaired.cadResult?.outputs[0].brep,'Legacy edit preserves hole semantics and repairs exact geometry');
 await load([box]);
 // A failed CAD request leaves the model intact and allows retry.
 await page.evaluate(()=>window.holeResponse='error');
 await page.locator('#cut-tool').click();await page.mouse.click(...await screen([30,30,20]));
 await page.locator('#hole-through').uncheck();await page.locator('#hole-depth').fill('8.86');
 await page.locator('#hole-apply').click();await page.waitForFunction(()=>document.getElementById('hole-error').textContent.includes('穴あけテストで失敗'));
 assert.deepEqual((await save()).features,[box]);assert.ok(await page.locator('#hole-apply').isEnabled());
 await page.evaluate(()=>window.holeResponse='hold');
 await page.locator('#hole-apply').click();await page.waitForFunction(()=>!!window.releaseHole);
 assert.equal(await page.locator('#hole-apply').isEnabled(),false);assert.equal(await page.locator('#hole-diameter').isEnabled(),false);
 await page.locator('#hole-cancel').click();await page.evaluate(()=>window.releaseHole());await page.waitForTimeout(500);
 assert.deepEqual((await save()).features,[box],'Cancelled result must never change model');
 assert.deepEqual(errors,[]);console.log('PASS exact blind/through holes, clean face boundaries/openings, repeated drilling, fractional height, legacy repair, undo/redo/reload, failure retry and cancellation; camera preserved');

}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
