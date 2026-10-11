import {binaryStlReport} from './stl-topology.mjs';
import {defaults} from '../src/geometry.js';
import * as THREE from 'three';
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
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 async function load(features){await page.locator('#file').setInputFiles({name:'box.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
 async function apply(){await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:120000});}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function edit(){await page.locator('#features .tree-row').last().locator('button.row-label').click();await page.locator('#cad-thickness').waitFor();}
 await load([{...defaults,id:'box',name:'対象',width:30,height:20,depth:20,x:0,y:0}]);
 await page.locator('#direct-enclose').dispatchEvent('click');
 assert.equal(await page.locator('#cad-thickness').inputValue(),'3','new enclosure defaults to 3 mm walls');
 await page.locator('#cad-boxMode').check();await page.locator('#cad-hinge').check();await page.locator('#cad-hingeEdge').selectOption('+Y');
 await apply();
 const project=await save(),operation=project.features.at(-1),frame=operation.analysis.hingeFrame;
 assert.equal(operation.spec.thickness,3);assert.equal(frame.axisIndex,0);
 const body=operation.outputs[0],u=frame.axisIndex,lo=Math.min(...body.vertices.filter((_,i)=>i%3===u)),hi=Math.max(...body.vertices.filter((_,i)=>i%3===u));
 assert.ok(Math.abs(frame.a[u]-lo)<1e-5&&Math.abs(frame.b[u]-hi)<1e-5,'saved hinge frame reaches both BOX ends');
 const exported=page.waitForEvent('download');await page.locator('#export-enclosure').click();const bytes=await fs.readFile(await(await exported).path()),count=bytes.readUInt32LE(80),report=binaryStlReport(bytes);
 const axis=new THREE.Vector3().setComponent(u,1),rotation=new THREE.Quaternion().setFromUnitVectors(axis,new THREE.Vector3(0,0,1)),hinge=new THREE.Vector3(...frame.point).applyQuaternion(rotation);
 const p=operation.spec,radius=Math.max(1,p.thickness*.55)*p.hardwareScale+p.hingeRadialGap+Math.max(.9,p.thickness*.65)*p.hardwareScale;
 let bottom=Infinity,hingeFloorArea=0;
 for(let i=0;i<count;i++){
  const points=Array.from({length:3},(_,j)=>new THREE.Vector3(...Array.from({length:3},(_,k)=>bytes.readFloatLE(84+i*50+12+j*12+k*4))));
  bottom=Math.min(bottom,...points.map(p=>p.z));
  if(points.every(p=>Math.abs(p.z)<1e-4)){
   const centroid=points.reduce((a,b)=>a.add(b),new THREE.Vector3()).divideScalar(3);
   if(Math.hypot(centroid.x-hinge.x,centroid.y-hinge.y)<radius)hingeFloorArea+=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length()/2;
  }
 }
 assert.ok(Math.abs(bottom)<1e-4);assert.ok(hingeFloorArea>10,'actual exported fixed hinge cap lies on Z=0 instead of floating above the bed');
 for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,'enclosure STL '+k);
 await edit();assert.equal(await page.locator('#cad-thickness').inputValue(),'3');await page.locator('#cad-thickness').fill('2');await apply();
 const custom=await save();assert.equal(custom.features.at(-1).spec.thickness,2);
 await load(custom.features);await edit();assert.equal(await page.locator('#cad-thickness').inputValue(),'2','saved wall thickness is preserved when reopening');
 await page.locator('#cad-cancel').click();
 assert.deepEqual(errors,[]);console.log('PASS 3 mm default, saved 2 mm preservation, exact hinge frame, downloaded STL hinge cap on Z=0, closed topology', {hingeFloorArea,...report});
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
