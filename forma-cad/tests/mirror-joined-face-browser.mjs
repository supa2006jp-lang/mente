import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
const dir='outputs/mirror-joined-face/';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const fixture=await fs.readFile(dir+'fixture.forma.json'),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true}),errors=[];p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept(d.defaultValue()));await p.goto('http://127.0.0.1:5188');
 const host=p.locator('#canvas-host'),canvas=p.locator('#canvas-host canvas');
 const frame=()=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);camera.position.fromArray(s);camera.quaternion.fromArray(s,3);camera.zoom=s[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const v=new THREE.Vector3(...point).project(camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];}
 async function select(point){await p.mouse.click(...await screen(point));await p.waitForFunction(()=>document.getElementById('canvas-host').dataset.selectedFaceCount==='1');await p.locator('#face-extrude-shortcut').waitFor();assert.match(await p.locator('#measurement-length').textContent(),/1,400|1400/);}
 async function save(){const event=p.waitForEvent('download');await p.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 for(const [name,point]of [['right',[12,6,10]],['left',[-12,6,10]]]){
  await p.locator('#file').setInputFiles({name:'mirror-joined.forma.json',mimeType:'application/json',buffer:fixture});await p.locator('#project-preview-open').click();await p.waitForFunction(()=>!document.getElementById('project-load-preview').open);await p.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await p.locator('#fit').click();await frame();await p.locator('#selection-mode').selectOption('face');await select(point);
  if(name==='right'){await p.screenshot({path:dir+'full-plane-selected.png'});await p.keyboard.down('Control');await p.mouse.click(...await screen([-12,6,10]));await p.keyboard.up('Control');await p.waitForFunction(()=>document.getElementById('canvas-host').dataset.selectedFaceCount==='0');await select(point);}
  await p.locator('#face-extrude-shortcut').click();await p.locator('#viewport-depth').fill('3');await p.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1'&&!document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',null,{timeout:60000});await p.locator('#extrude-distance button[type=submit]').click();await p.locator('#extrude-distance').waitFor({state:'hidden',timeout:60000});
  const data=await save(),output=data.features.at(-1).cadResult.outputs.find(o=>o.id==='right'),shape=R.deserializeShape(output.brep).asShape3D();assert(Math.abs(R.measureVolume(shape)-18200)<1e-5);shape.delete();assert.equal(data.features.length,4);await p.locator('#undo').click();assert.equal((await save()).features.length,3);await p.locator('#redo').click();assert.equal((await save()).features.length,4);
 }
 await p.screenshot({path:dir+'full-plane-extruded.png'});assert.deepEqual(errors,[]);const proof={oldJoinedMirrorBrep:true,bothHalvesSelectWholePlane:true,selectedArea:1400,ctrlOtherHalfTogglesSamePlane:true,extrudedVolume:18200,save:true,undoRedo:true,errors};await fs.writeFile(dir+'browser-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){for(const p of browser.contexts().flatMap(c=>c.pages())){await p.screenshot({path:dir+'failure.png'}).catch(()=>{});console.error(await p.locator('#viewport-depth-error').textContent().catch(()=>''));}throw error;}
finally{await browser.close();}
