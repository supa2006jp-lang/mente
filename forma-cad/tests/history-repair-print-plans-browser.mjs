import {chromium} from 'playwright';
import * as THREE from 'three';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep))throw Error();
  res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1900,height:1200},acceptDownloads:true}),errors=[];
page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
const host=page.locator('#canvas-host');
async function load(features){
 await page.locator('#file').setInputFiles({name:'test.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>!document.querySelector('#project-load-preview').open);
}
async function save(){
 const event=page.waitForEvent('download');await page.locator('#save').click();
 return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));
}
async function screen(point){
 const rect=await host.locator('canvas').boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip'));
 const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);
 camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const projected=new THREE.Vector3(...point).project(camera);
 return [rect.x+(projected.x+1)*rect.width/2,rect.y+(1-projected.y)*rect.height/2];
}
try{
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 await page.goto('http://127.0.0.1:'+server.address().port);
 const body={...defaults,id:'block',kind:'extrusion',name:'元の直方体',width:20,height:20,depth:10};
 const shell={type:'shell',id:'shell',target:'block',thickness:.5,direction:'内側',faces:[{bodyId:'block',point:[2,3,10],normal:[0,0,1]}]};
 await load([body,{id:'shell',kind:'cadop',name:'上を開くシェル',spec:shell,...runOperation([body],shell)}]);
 await page.locator('#features .row-label').first().click();
 await page.locator('#profile').selectOption('circle');
 await page.locator('#diameter').fill('20');
 await page.locator('#history-reference-repair-open').waitFor({state:'visible'});
 await page.locator('#history-reference-repair-open').click();
 await page.locator('#history-reference-repair').waitFor();
 const candidate=page.locator('[data-repair-candidate]').first();
 await candidate.hover();await candidate.click();
 const preview=page.locator('[data-repair=preview]');
 assert(!(await preview.isDisabled()));
 await preview.click();
 await page.waitForFunction(()=>!document.querySelector('[data-repair=apply]').disabled);
 await page.locator('[data-repair=apply]').click();
 await page.waitForFunction(()=>!document.querySelector('#history-reference-repair').open);
 const repaired=await save();
 assert.equal(repaired.features[0].profile,'circle');
 assert.equal(repaired.features[1].spec.type,'shell');
 await page.locator('#undo').click();
 assert.equal((await save()).features[0].profile,'rect');
 await page.locator('#redo').click();
 assert.equal((await save()).features[0].profile,'circle');

 const parts=Array.from({length:4},(_,i)=>({...defaults,id:'part-'+i,kind:'extrusion',name:'部品'+(i+1),width:110,height:100,depth:10,x:i*200,y:200,z:20}));
 await load(parts);const before=await save();
 await page.locator('#print-layout-tool').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-apply').disabled);
 assert.equal(await page.locator('#print-layout-plate option').count(),4);
 await page.locator('[data-print-compare=part-0]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#print-layout-orientation-candidates button').length===6);
 assert.match(await page.locator('#print-layout-orientation-candidates [data-orientation="z+"]').textContent(),/現在.*おすすめ/);
 await page.locator('#print-layout-orientation-candidates [data-orientation="z-"]').click();
 assert.equal(await page.locator('[data-print-orientation=part-0]').inputValue(),'z+');
 await page.locator('#print-layout-orientation-apply').click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#canvas-host').dataset.printLayout).placements.some(part=>part.orientation==='z-'));
 await page.locator('[data-cube-direction="0,0,1"]').dispatchEvent('keydown',{key:'Enter'});
 await page.waitForTimeout(250);
 const start=await screen([0,0,10]),end=await screen([18,10,10]);
 await page.mouse.move(...start);await page.mouse.down();await page.mouse.move(...end,{steps:5});await page.mouse.up();
 const moved=JSON.parse(await host.getAttribute('data-print-layout')).placements[0];
 assert.ok(Math.abs((moved.min[0]+moved.max[0])/2-18)<.5);
 assert.ok(Math.abs((moved.min[1]+moved.max[1])/2-10)<.5);
 await page.locator('[data-print-lock=part-0]').click();
 assert(await page.locator('[data-print-orientation=part-0]').isDisabled());
 await page.locator('#print-layout-repack').click();
 const fixed=JSON.parse(await host.getAttribute('data-print-layout')).placements[0];
 assert.equal(fixed.locked,true);
 assert.ok(fixed.min.every((value,i)=>Math.abs(value-moved.min[i])<1e-10));
 assert.equal(fixed.orientation,'z-');
 await page.waitForFunction(()=>document.querySelector('#print-layout-warning-status').textContent.includes('見つかりませんでした'));
 const download=page.waitForEvent('download');await page.locator('#print-layout-export').click();
 const exported=unzipSync(await fs.readFile(await(await download).path()));
 const xml=strFromU8(exported['3D/3dmodel.model']);
 const vertices=[...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map(row=>row.slice(1).map(Number));
 assert.ok(vertices.length);
 assert.ok(vertices.every(([x,y,z])=>x>=2-1e-5&&x<=178+1e-5&&y>=2-1e-5&&y<=178+1e-5&&z>=-1e-5));
 await page.locator('#print-layout-overview summary').click();
 await page.locator('#print-layout-check-all').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-print-plate-index]')].length===4&&
  [...document.querySelectorAll('[data-print-plate-index]')].every(button=>button.textContent.includes('浮き 0')));
 const batchDownload=page.waitForEvent('download');await page.locator('#print-layout-export-all').click();
 const batch=unzipSync(await fs.readFile(await(await batchDownload).path()));
 assert.equal(Object.keys(batch).length,4);
 for(const [index,[name,data]] of Object.entries(batch).entries()){
  assert.match(name,new RegExp('-plate-'+(index+1)+'\\.3mf$'));
  assert.ok(unzipSync(data)['3D/3dmodel.model']);
 }
 await page.locator('#print-layout-plate').selectOption('2');
 assert.equal(JSON.parse(await host.getAttribute('data-print-layout')).plateIndex,2);
 await page.locator('#print-layout-apply').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-dialog').open);
 const saved=await save();
 assert.deepEqual(saved.features.slice(0,4),before.features);
 assert.equal(saved.features.at(-1).spec.type,'printLayoutPlan');
 assert.equal(saved.features.at(-1).outputs.length,0);
 assert.equal(saved.features.at(-1).spec.orientations['part-0'],'z-');
 assert.equal(saved.features.at(-1).spec.placementOverrides.find(row=>row.id==='part-0').locked,true);
 await load(saved.features);await page.locator('#print-layout-tool').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-apply').disabled);
 assert.equal(await page.locator('[data-print-orientation=part-0]').inputValue(),'z-');
 assert.equal(await page.locator('[data-print-lock=part-0]').getAttribute('aria-pressed'),'true');
 assert.ok(JSON.parse(await host.getAttribute('data-print-layout')).placements[0].min.every((value,i)=>Math.abs(value-moved.min[i])<1e-10));
 await page.locator('#print-layout-cancel').click();
 assert.deepEqual((await save()).features,saved.features);
 await page.locator('#print-layout-tool').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-apply-model').disabled);
 await page.locator('#print-layout-plate').selectOption('1');
 const active=JSON.parse(await host.getAttribute('data-print-layout'));
 await page.locator('#print-layout-apply-model').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-dialog').open);
 const placed=await save(),operation=placed.features.at(-1);
 assert.deepEqual(placed.features.slice(0,-1),saved.features);
 assert.equal(operation.spec.type,'printLayout');
 assert.deepEqual(operation.outputs.map(output=>output.id),active.placements.map(part=>part.id));
 await page.locator('#undo').click();
 assert.deepEqual((await save()).features,saved.features);
 const stem=R.makeBox([0,0,0],[10,10,20]),roof=R.makeBox([0,0,15],[30,10,20]),cantilever=stem.fuse(roof);
 try{
  const output={id:'cantilever',...cadMesh(cantilever),brep:serializeCadShape(cantilever)};
  await load([{kind:'cadop',id:'cantilever',name:'張り出し部品',outputs:[output],remove:[]}]);
 }finally{stem.delete();roof.delete();cantilever.delete();}
 await page.locator('#print-layout-tool').click();
 await page.waitForFunction(()=>document.querySelector('#print-layout-warning-status').textContent.includes('オーバーハングの候補 1'));
 await page.locator('#print-layout-overview').evaluate(el=>{el.open=true;});
 const zoomBefore=JSON.parse(await host.getAttribute('data-camera-state'))[7];
 await page.locator('[data-print-plate-index="0"]').click();
 await page.waitForFunction(before=>JSON.parse(document.querySelector('#canvas-host').dataset.cameraState)[7]>before,zoomBefore);
 await page.locator('[data-print-compare=cantilever]').click();
 await page.waitForFunction(()=>document.querySelector('#print-layout-orientation-candidates [data-orientation="z-"]')?.textContent.includes('おすすめ'));
 await page.locator('#print-layout-orientation-close').click();
 await page.locator('#print-layout-cancel').click();
 assert.deepEqual(errors,[]);
 console.log('PASS reference suggestions and repair, orientation comparison and recommendation, warning focus, ZIP with four 3MFs, placement lock and save/reopen');
}catch(error){
 console.error('UI errors',errors);
 console.error('Repair',await page.locator('[data-repair=status]').textContent().catch(()=>null));
 console.error('Layout',await page.locator('#print-layout-error').textContent().catch(()=>null));
 await page.screenshot({path:'.sites-runtime/history-repair-print-plans-failure.png'});
 throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
