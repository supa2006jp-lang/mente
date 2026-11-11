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
 await page.locator('[data-cube-direction="0,0,1"]').dispatchEvent('keydown',{key:'Enter'});
 await page.waitForTimeout(200);
 await page.mouse.click(...await screen([2,3,10]));
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
 await page.locator('[data-print-orientation=part-0]').selectOption('z-');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#canvas-host').dataset.printLayout).placements.some(part=>part.orientation==='z-'));
 const download=page.waitForEvent('download');await page.locator('#print-layout-export').click();
 const exported=unzipSync(await fs.readFile(await(await download).path()));
 const xml=strFromU8(exported['3D/3dmodel.model']);
 const vertices=[...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map(row=>row.slice(1).map(Number));
 assert.ok(vertices.length);
 assert.ok(vertices.every(([x,y,z])=>x>=2-1e-5&&x<=178+1e-5&&y>=2-1e-5&&y<=178+1e-5&&z>=-1e-5));
 await page.locator('#print-layout-plate').selectOption('2');
 assert.equal(JSON.parse(await host.getAttribute('data-print-layout')).plateIndex,2);
 await page.locator('#print-layout-apply').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-dialog').open);
 const saved=await save();
 assert.deepEqual(saved.features.slice(0,4),before.features);
 assert.equal(saved.features.at(-1).spec.type,'printLayoutPlan');
 assert.equal(saved.features.at(-1).outputs.length,0);
 assert.equal(saved.features.at(-1).spec.orientations['part-0'],'z-');
 await load(saved.features);await page.locator('#print-layout-tool').click();
 await page.waitForFunction(()=>!document.querySelector('#print-layout-apply').disabled);
 assert.equal(await page.locator('[data-print-orientation=part-0]').inputValue(),'z-');
 await page.locator('#print-layout-cancel').click();
 assert.deepEqual((await save()).features,saved.features);
 assert.deepEqual(errors,[]);
 console.log('PASS reference reselection/preview/apply/undo, separate print orientations, multi-plate 3MF, unchanged assembly, save/reopen');
}catch(error){
 console.error('UI errors',errors);
 console.error('Repair',await page.locator('[data-repair=status]').textContent().catch(()=>null));
 console.error('Layout',await page.locator('#print-layout-error').textContent().catch(()=>null));
 await page.screenshot({path:'.sites-runtime/history-repair-print-plans-failure.png'});
 throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
