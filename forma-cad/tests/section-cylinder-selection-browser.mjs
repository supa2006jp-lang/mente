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

 const cylinder={...defaults,id:'c',kind:'extrusion',name:'円柱',profile:'circle',diameter:60,depth:40};
 const source=featureSolid(cylinder),parts=source.split('XY',20),outputs=[];for(const [id,part] of [['c',parts.negative],['s',parts.positive]])outputs.push({id,...part.mesh({tolerance:.08,angularTolerance:.15}),planarFaces:part.faces.filter(face=>face.geomType==='PLANE').map(face=>face.hashCode),brep:part.serialize()});source.delete();parts.positive.delete();parts.negative.delete();
 const legacy={kind:'cadop',id:'s',name:'断面で分離',spec:{type:'split',id:'s',target:'c',plane:'XY',offset:20,keep:'both',sectionSplit:true,colorize:false},outputs,remove:[]};
 async function sidePoint(angle,z){const data=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),r=await page.locator('canvas').boundingBox(),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.01,10000);camera.position.fromArray(data,0);camera.quaternion.fromArray(data,3);camera.zoom=data[7];camera.updateMatrixWorld(true);camera.updateProjectionMatrix();const a=Math.atan2(data[1],data[0])+angle*Math.PI/180,p=new THREE.Vector3(30*Math.cos(a),30*Math.sin(a),z).project(camera);return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}
 async function clickSide(angle,z,modifiers=[]){const p=await sidePoint(angle,z);await page.mouse.click(p.x,p.y,{modifiers});}
 await load([cylinder,legacy]);await page.locator('#selection-mode').selectOption('face');
 for(const z of [10,30]){await clickSide(-55,z);assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'1');assert.ok((await page.locator('#measurement-length').textContent()).includes('60'),'complete cylinder retains diameter');await page.screenshot({path:'.sites-runtime/section-cylinder-selected-'+z+'.png'});await page.keyboard.down('Control');await clickSide(55,z);await page.keyboard.up('Control');assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'0','opposite half belongs to the same selectable sidewall');}
 await clickSide(-55,10);await page.locator('#direct-pull').click();await page.locator('#cad-distance').fill('-.2');await page.locator('#cad-apply').click();await page.locator('#tools-dialog').waitFor({state:'hidden',timeout:40000});let data=await save(),pull=data.features.at(-1);assert.equal(pull.spec.faces.length,2,'legacy pull receives both half faces');const shape=R.deserializeShape(pull.outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(shape)-Math.PI*29.8**2*20)<.001,'pull applies around entire circumference');shape.delete();await page.locator('#undo').click();assert.equal((await save()).features.length,2);await load((await save()).features);await page.locator('#selection-mode').selectOption('face');await clickSide(-55,10);await page.keyboard.down('Control');await clickSide(55,10);await page.keyboard.up('Control');assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'0','legacy saved models retain whole-side selection');
 await load([cylinder]);await page.locator('#section-toggle').click();await plane.selectOption('XY');await offset.fill('20');data=await apply();assert.equal(data.features.at(-1).outputs[0].faceGroups.filter(g=>!data.features.at(-1).outputs[0].planarFaces.includes(g.faceId)).length,1);await page.locator('#selection-mode').selectOption('face');await clickSide(-55,10);await page.keyboard.down('Control');await clickSide(55,10);await page.keyboard.up('Control');assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-face-count'),'0','new split full circumference can be selected and deselected from either side');assert.deepEqual(errors,[]);await context.close();console.log('PASS legacy and new split full sidewall clicks, same-face Ctrl toggle, diameter, full-circumference pull, undo and file reload'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
