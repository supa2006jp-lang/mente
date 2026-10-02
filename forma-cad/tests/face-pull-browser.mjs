import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as THREE from 'three';import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {defaults,rebuild} from '../src/geometry.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const cylinder={...defaults,id:'c',name:'cylinder',profile:'circle',diameter:10,depth:5},spec={type:'thread',target:'c',surfacePoint:[5,0,2],profile:'metric60',pitch:1.5,fullLength:true},thread=runOperation([cylinder],spec);
const features=[cylinder,{kind:'cadop',id:'thread',name:'thread',spec,...thread}],mesh=rebuild(features).get('c'),g=mesh.geometry,attr=g.attributes.position;
const candidates=new Map();
for(let i=0;i<g.index.count;i+=3){
 const group=g.userData.faceGroups.find(f=>i>=f.start&&i<f.start+f.count);if(g.userData.planarFaces.includes(group.faceId))continue;
 const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(attr,g.index.getX(i+j))),normal=b.clone().sub(a).cross(c.clone().sub(a)),area=normal.length(),point=a.add(b).add(c).multiplyScalar(1/3);
 normal.normalize();if(normal.y>-.25||point.z<1||point.z>4||Math.hypot(point.x,point.y)<5.25||Math.abs(normal.z)<.4)continue;
 const ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,-100,0)),new THREE.Vector3(0,1,0)),hit=ray.intersectObject(mesh,false)[0];
 if(!hit||hit.point.distanceTo(point)>.005)continue;
 if(!candidates.has(group.faceId)||area>candidates.get(group.faceId).area)candidates.set(group.faceId,{area,point});
}
assert.ok(candidates.size>=2);
const points=[...candidates.values()].sort((a,b)=>b.area-a.area).slice(0,2).map(c=>c.point);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'thread.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.locator('[data-view=front]').click();await page.locator('#fit').click();await page.waitForTimeout(200);
 const r=await page.locator('canvas').boundingBox(),bounds=new THREE.Box3().setFromBufferAttribute(attr),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()).length(),scale=r.height/(size*1.25/Math.min(r.width/r.height,1));
 const click=async(index,shift=false)=>{const p=points[index];if(shift)await page.keyboard.down('Shift');await page.mouse.click(r.x+r.width/2+(p.x-center.x)*scale,r.y+r.height/2-(p.z-center.z)*scale);if(shift)await page.keyboard.up('Shift');};
 const count=async()=>Number(await page.locator('#canvas-host').getAttribute('data-selected-face-count'));
 await click(0);assert.equal(await count(),1);await click(1,true);assert.equal(await count(),2);
 await click(1,true);assert.equal(await count(),1);await click(1,true);assert.equal(await count(),2);
 await page.screenshot({path:'.sites-runtime/multi-face-selected.png'});
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pull');await page.locator('#cad-distance').fill('-0.1');await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,{},{timeout:95000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const download=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8')),last=saved.features.at(-1);
 assert.equal(last.spec.type,'pull');assert.equal(last.spec.faces.length,2);assert.ok(last.outputs[0].threadSource);
 assert.ok(R.measureVolume(R.deserializeShape(last.outputs[0].brep).asShape3D())<R.measureVolume(R.deserializeShape(thread.outputs[0].brep).asShape3D()));
 assert.equal(await count(),0);assert.deepEqual(errors,[]);
 await page.screenshot({path:'.sites-runtime/multi-face-pulled.png'});console.log('PASS Shift multi-select, toggle, curved thread pull, save and selection reset');
}finally{await browser.close();}
