import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
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
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const handle=page.locator('#extrude-handle'),wheel=page.locator('#extrude-operation-wheel');
 const normal=f=>f.frame?.n||({XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[f.plane]);
 async function load(features){await page.locator('#file').setInputFiles({name:'drag.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('#features .row-label').last().click();await wheel.waitFor();await page.locator('[data-view=iso]').click();await page.waitForTimeout(100);}
 async function axis(f){const r=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(state);c.quaternion.fromArray(state,3);c.zoom=state[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const base=new THREE.Vector3(f.x,f.y,f.z),a=base.clone().project(c),b=base.clone().add(new THREE.Vector3(...normal(f))).project(c);let dx=(b.x-a.x)*r.width/2,dy=-(b.y-a.y)*r.height/2;if(Math.hypot(dx,dy)<.1){dx=0;dy=-r.height/(200/c.zoom);}return {dx,dy};}
 async function direction(f){await page.waitForTimeout(60);const a=await axis(f),depth=Number(await page.locator('#depth').inputValue()),sign=depth<0?-1:1,angle=await handle.evaluate(e=>Number(e.style.transform.match(/rotate\(([-+0-9.e]+)deg\)/)[1])*Math.PI/180);assert.ok((Math.sin(angle)*a.dx*sign-Math.cos(angle)*a.dy*sign)/Math.hypot(a.dx,a.dy)>.999,'arrow points along the signed extrusion direction');}
 async function drag(f,target){const a=await axis(f),r=await handle.boundingBox(),depth=Number(await page.locator('#depth').inputValue()),x=r.x+r.width/2,y=r.y+r.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+a.dx*(target-depth),y+a.dy*(target-depth),{steps:8});await page.waitForTimeout(60);const result={value:Number(await page.locator('#depth').inputValue()),snapped:await handle.getAttribute('data-snapped')==='true'};await direction(f);await page.mouse.up();assert.equal(await handle.getAttribute('data-snapped'),null,'snap indicator is cleared after dragging');return result;}
 const draft={...defaults,id:'s',name:'押し出し',kind:'extrusion',width:40,height:30,depth:5};
 for(const plane of ['XY','XZ','YZ','CUSTOM']){const f={...draft,plane,...(plane==='CUSTOM'?{frame:{u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})};await load([f]);await direction(f);await page.locator('#viewport-depth').fill('-5');await direction(f);await page.locator('#viewport-extrude-cancel').click();}
 await load([draft]);await page.locator('#snap-enabled').check();await page.locator('#snap-step').selectOption('10');assert.deepEqual(await drag(draft,19.7),{value:20,snapped:true});const free=await drag(draft,16.5);assert.ok(Math.abs(free.value-16.5)<.1);assert.equal(free.snapped,false);
 await page.locator('#snap-step').selectOption('5');assert.deepEqual(await drag(draft,-9.7),{value:-10,snapped:true});
 await page.locator('#snap-step').selectOption('1');assert.deepEqual(await drag(draft,7.9),{value:8,snapped:true});
 await page.locator('#snap-enabled').uncheck();const off=await drag(draft,19.7);assert.ok(Math.abs(off.value-19.7)<.1);assert.equal(off.snapped,false);const zero=await drag(draft,-.05);assert.equal(zero.value,-.1);await direction(draft);
 await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#viewport-depth').fill('5');await direction(draft);await page.locator('#snap-enabled').check();await page.locator('#snap-step').selectOption('10');assert.deepEqual(await drag(draft,-19.7),{value:-20,snapped:true});await page.locator('#viewport-depth').fill('19.7');assert.equal(Number(await page.locator('#depth').inputValue()),19.7,'typed distances are not snapped');await page.locator('#viewport-extrude-cancel').click();
 const base={...defaults,id:'b',name:'本体',kind:'extrusion',width:80,height:60,depth:20},cut={...defaults,id:'c',name:'円の切り取り',kind:'extrusion',profile:'circle',diameter:20,z:20,depth:-10,operation:'cut',target:'b'};await load([base,cut]);await direction(cut);await page.screenshot({path:'.sites-runtime/extrusion-arrow-negative.png'});assert.deepEqual(await drag(cut,-19.7),{value:-20,snapped:true});await page.locator('#viewport-extrude-cancel').click();assert.deepEqual(errors,[]);await context.close();console.log('PASS signed arrows on XY/XZ/YZ/custom planes and end-on view, positive/negative grid drag, changed spacing, free/off and precise typing, zero crossing, negative circular cutting'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
