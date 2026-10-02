import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {featureSolid,runOperation} from '../src/kernel.js';
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
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 const panel=page.locator('#section-panel'),split=page.locator('#section-split'),offset=page.locator('#section-offset'),plane=page.locator('#section-plane'),keep=page.locator('#section-keep');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:40,z:-10};
 async function load(features){await page.locator('#file').setInputFiles({name:'section.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').click();}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function apply(){await split.click();await panel.waitFor({state:'hidden',timeout:40000});return save();}
 async function edit(index=1){await page.locator('#features .row-label').nth(index).click();await panel.waitFor();assert.equal(await split.textContent(),'変更を適用');assert.equal(await page.locator('#section-target').isDisabled(),true);}
 async function colors(){return page.locator('#bodies [data-body-color]').evaluateAll(items=>Object.fromEntries(items.map(e=>[e.dataset.bodyId,e.dataset.bodyColor])));}
 function solidVolume(o){const shape=R.deserializeShape(o.brep).asShape3D(),valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());return R.measureVolume(shape);}finally{valid.delete();shape.delete();}}
 function range(o,axis){const v=o.vertices.filter((_,i)=>i%3===axis);return [Math.min(...v),Math.max(...v)];}

 const explode=page.locator('#explode-bodies'),isolate=page.locator('#isolate-selection'),restore=page.locator('#restore-isolation'),gap=page.locator('#explode-gap');
 const spec={type:'split',id:'s',target:'box',plane:'XY',offset:10,keep:'both',sectionSplit:true,splitFrame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]}},f={kind:'cadop',id:'s',name:'断面で分離',spec,...runOperation([box],spec)},other={...box,id:'other',name:'別のボディ',x:100};
 async function visible(){return page.locator('#bodies .tree-row').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.dataset.bodyId,r.querySelector('.eye').getAttribute('aria-pressed')==='true'])));}
 async function screen(point){const data=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),r=await page.locator('canvas').boundingBox(),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.01,10000);camera.position.fromArray(data,0);camera.quaternion.fromArray(data,3);camera.zoom=data[7];camera.updateMatrixWorld(true);camera.updateProjectionMatrix();const p=new THREE.Vector3(...point).project(camera);return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}
 await load([box]);assert.equal(await explode.isVisible(),false);assert.equal(await isolate.isDisabled(),true);
 await load([box,f,other]);const initial=await save();await explode.click();assert.equal(await page.locator('#canvas-host').getAttribute('data-exploded'),'true');let offsets=JSON.parse(await page.locator('#canvas-host').getAttribute('data-display-offsets'));assert.deepEqual(offsets,{box:[0,0,-10],s:[0,0,10]});await gap.fill('40');offsets=JSON.parse(await page.locator('#canvas-host').getAttribute('data-display-offsets'));assert.equal(offsets.box[2],-20);await gap.fill('20');const viewed=await save();assert.deepEqual(viewed.features,initial.features,'display explosion does not change saved history or geometry');assert.deepEqual(viewed.preview,initial.preview,'saved thumbnail keeps actual body positions');await page.screenshot({path:'.sites-runtime/body-display-exploded.png'});
 const point=await screen([25,-15,0]);
 async function crossing(){await page.mouse.move(point.x+4,point.y-4);await page.mouse.down();await page.mouse.move(point.x-4,point.y+4,{steps:6});assert.equal(await page.locator('#selection-box').isVisible(),true);await page.mouse.up();}
 await page.locator('#selection-mode').selectOption('body');await crossing();assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-body-count'),'1','crossing selects a body at its display position');
 await page.locator('#selection-mode').selectOption('face');await crossing();assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'1','crossing selects exposed face at its display position');await page.mouse.click(point.x,point.y);assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'1');assert.ok((await page.locator('#measurement-title').textContent()).includes('平面'),'exposed cut face is selectable');assert.ok((await page.locator('#measurement-length').textContent()).replaceAll(',','').includes('2400'),await page.locator('#measurement-length').textContent());await page.screenshot({path:'.sites-runtime/body-display-cut-face.png'});
 await page.locator('#solid-tool').click();assert.equal(await page.locator('#canvas-host').getAttribute('data-exploded'),'false','extrusion returns display to actual positions');await page.locator('#viewport-operation').selectOption('cut');await page.locator('#viewport-depth').fill('-.5');await page.locator('#viewport-target').selectOption('box');await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('extrude-distance').hidden,null,{timeout:15000}).catch(async e=>{console.log('Extrusion error',await page.locator('#viewport-depth-error').textContent(),await page.locator('#error').textContent(),await page.locator('#status').textContent());await page.screenshot({path:'.sites-runtime/body-display-extrusion-error.png'});throw e;});let data=await save(),cut=data.features.at(-1);assert.equal(cut.region.offset,10,'extrusion starts at actual section plane rather than display plane');assert.ok(Math.abs(solidVolume(cut.cadResult.outputs[0])-60*40*19.5)<.001,'cut applies at actual position');await explode.click();assert.deepEqual(JSON.parse(await page.locator('#canvas-host').getAttribute('data-display-offsets')),{box:[0,0,-10],s:[0,0,10]},'downstream machining preserves split display offsets');await explode.click();await page.locator('#undo').click();assert.deepEqual((await save()).features,initial.features);
 await page.locator('#bodies [data-body-id="other"] .eye').click();await page.locator('#bodies [data-body-id="box"] .row-label').click();await isolate.click();assert.deepEqual(await visible(),{box:true,s:false,other:false});assert.equal(await restore.isVisible(),true);assert.deepEqual((await save()).features,initial.features,'isolation does not change model');await page.screenshot({path:'.sites-runtime/body-display-isolated.png'});await restore.click();assert.deepEqual(await visible(),{box:true,s:true,other:false},'restore preserves previously hidden bodies');
 await page.locator('#bodies [data-body-id="s"] .body-isolate').click();assert.deepEqual(await visible(),{box:false,s:true,other:false},'per-body isolation works');await page.locator('#bodies [data-body-id="other"] .eye').click();assert.deepEqual(await visible(),{box:true,s:true,other:true},'eye toggle exits isolation and applies requested visibility');assert.equal(await restore.isVisible(),false);
 await explode.click();await page.locator('#section-toggle').click();assert.equal(await page.locator('#canvas-host').getAttribute('data-exploded'),'false','section editing uses actual positions');assert.equal(await explode.isDisabled(),true,'display controls pause during section preview');await page.locator('#section-close').click();await explode.click();await page.locator('#bodies [data-body-id="s"] .body-isolate').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#canvas-host').getAttribute('data-exploded'),'false');assert.deepEqual(await visible(),{box:true,s:true,other:true});await load(initial.features);assert.equal(await page.locator('#canvas-host').getAttribute('data-exploded'),'false');assert.deepEqual(JSON.parse(await page.locator('#canvas-host').getAttribute('data-isolated-bodies')),[]);assert.deepEqual(errors,[]);await context.close();console.log('PASS display-only explosion/gap, actual saved coordinates and thumbnail, body/face range selection, exposed cut-face picking and extrusion position, isolation/manual visibility restoration, eye toggle, Escape, section start and reload'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
