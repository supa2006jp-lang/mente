import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';
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
 const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),body={...defaults,id:'body',name:'本体',kind:'extrusion',width:30,height:30,depth:10};
 async function load(features,view){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'direction.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#selection-mode').selectOption('auto');await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(150);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));}
 const sketch={...defaults,id:'sketch',name:'側面スケッチ',kind:'sketch',width:10,height:6,plane:'XZ',y:-15,z:5};
 await load([body,sketch],'front');const cameraBefore=JSON.parse(await host.getAttribute('data-camera-state')); await page.locator('#solid-tool').click();await page.mouse.click(...await screen([1,-15,5.3]));await page.locator('#extrude-distance').waitFor();await page.waitForTimeout(300);assert.notEqual(await page.locator('#viewport-operation').inputValue(),'cut','positive initial side extrusion does not cut');assert.equal(Number(await page.locator('#viewport-depth').inputValue()),2);assert.ok(JSON.parse(await host.getAttribute('data-camera-state')).every((v,i)=>Math.abs(v-cameraBefore[i])<1e-6),'direction correction does not move camera');
 await page.locator('#viewport-depth').fill('-2');await page.waitForFunction(()=>document.getElementById('operation').value==='cut');await page.locator('#viewport-depth').fill('2');await page.waitForFunction(()=>document.getElementById('operation').value!=='cut');await page.locator('#viewport-operation').selectOption('join');await page.locator('#extrude-distance [type=submit]').click();await page.locator('#extrude-distance').waitFor({state:'hidden'});let data=await save(),added=data.features.at(-1);assert.deepEqual(added.frame.n,[0,-1,0]);assert.equal(added.depth,2);assert.equal(data.features[1].plane,'XZ');assert.equal(data.features[1].frame,undefined);assert.ok(Math.abs([...rebuild(data.features).values()].reduce((sum,mesh)=>sum+volume(mesh.geometry),0)-9120)<.01);
 // Reload retains the new positive frame, with undo/redo retaining the geometry.
 await load(data.features,'front');await page.locator('#undo').click();await page.locator('#redo').click();assert.deepEqual((await save()).features.at(-1).frame.n,[0,-1,0]);
 const bottom={...sketch,plane:'XY',y:0,z:0,name:'底面スケッチ'};await load([body,bottom],'bottom');await page.locator('#solid-tool').click();await page.mouse.click(...await screen([1,1,0]));await page.locator('#extrude-distance').waitFor();await page.waitForTimeout(300);assert.notEqual(await page.locator('#viewport-operation').inputValue(),'cut');await page.locator('#extrude-distance [type=submit]').click();await page.locator('#extrude-distance').waitFor({state:'hidden'});data=await save();assert.deepEqual(data.features.at(-1).frame.n,[0,0,-1]);assert.equal(data.features.at(-1).depth,2);
 const line={...bottom,profile:'line',mode:'thin',width:10,name:'底面の線'};await load([body,line],'bottom');await page.locator('#sketches [data-sketch-group] .row-label').first().click();await page.locator('#thin-tool').click();await page.locator('#extrude-distance').waitFor();await page.waitForTimeout(200);assert.equal(Number(await page.locator('#viewport-depth').inputValue()),2);await page.locator('#extrude-distance [type=submit]').click();await page.locator('#extrude-distance').waitFor({state:'hidden'});data=await save();assert.deepEqual(data.features.at(-1).frame.n,[0,0,-1]);assert.equal(data.features.at(-1).depth,2);
 assert.deepEqual(errors,[]);console.log('PASS outward positive side/bottom/thin extrusion, negative auto-cut, unchanged camera/sketch, save/reload and undo/redo');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
