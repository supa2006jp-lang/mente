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
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec){window.cadJobs.push(payload.spec.type);window.latestSpec=payload.spec;}return post.call(this,payload,...args);};});
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){const op=m.spec?.type==='preview'?m.spec.operation:m.spec;if(window.forceCadError&&['fillet','shell'].includes(op?.type)){const error=window.forceCadError;setTimeout(()=>this.onmessage?.({data:{id:m.id,error}}),5);return;}return post.call(this,m,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),picker=page.locator('#selection-candidates');
 const back={...defaults,id:'back',name:'奥の本体',kind:'extrusion',width:40,height:30,depth:10,z:0},front={...back,id:'front',name:'手前の本体',z:20};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'overlap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}



 const marker=page.locator('#selected-point-marker'),measure=page.locator('#point-distance');
 const state=async()=>JSON.parse(await host.getAttribute('data-point-distance'));
 async function chooseVertex(point,{outside=false,body='back'}={}){
  const pixel=await screen(point);if(outside){pixel[0]+=7;pixel[1]-=7;}await page.mouse.click(...pixel);await picker.waitFor();
  const key=body+':vertex:'+point.join(',');const exact=picker.locator('[data-kind=vertex][data-key="'+key+'"]');await exact.hover();assert.equal(await host.getAttribute('data-selection-candidate-preview'),key);await exact.click();await marker.waitFor();await picker.locator('[data-close]').click();await page.mouse.move(30,30);await page.waitForTimeout(80);assert.deepEqual(JSON.parse(await host.getAttribute('data-selected-point')).point,point);assert.equal(JSON.parse(await host.getAttribute('data-selected-point')).kind,'vertex');
 }
 await load([back,front]);const original=(await save()).features;
 // Reproduce the reported case: center A selected in face mode, then a corner B.
 await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([8,6,30]));await picker.waitFor();await picker.locator('[data-kind=faceCenter][data-body-id=back]').first().click();await picker.locator('[data-close]').click();await page.locator('#point-measure').click();await chooseVertex([20,15,10],{outside:true});assert.deepEqual((await state()).a,[0,0,10]);assert.deepEqual((await state()).b,[20,15,10]);assert.deepEqual((await state()).delta,[20,15,0]);assert.equal(await measure.locator('[data-distance]').textContent(),'25.00 mm');assert.match(await measure.locator('[data-b]').textContent(),/奥の本体.*角の頂点/);assert.deepEqual((await save()).features,original);await measure.locator('[data-clear]').click();assert.match(await page.locator('#measurement-title').textContent(),/角の頂点/);
 // A corner can also be A. Measure a diagonal between two actual body vertices.
 await page.locator('#selection-mode').selectOption('auto');await chooseVertex([-20,-15,0]);await page.locator('#point-measure').click();await chooseVertex([20,15,10]);assert.deepEqual((await state()).delta,[40,30,10]);assert.equal(await measure.locator('[data-distance]').textContent(),'50.99 mm');await page.locator('[data-view=iso]').click();await page.waitForTimeout(120);await page.screenshot({path:'.sites-runtime/vertex-distance.png'});await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);
 // During measurement the list contains point choices, regardless of the normal filter.
 await page.mouse.click(...await screen([-19.8,14.8,30]));await picker.waitFor();assert.equal(await picker.locator('[data-kind=face],[data-kind=body],[data-kind=edge]').count(),0);assert.ok(await picker.locator('[data-kind=vertex]').count()>0);await picker.locator('[data-close]').click();
 // B can be replaced by a face center; old measurement and other selection actions still work.
 await page.mouse.click(...await screen([8,6,30]));await picker.waitFor();await picker.locator('[data-kind=faceCenter][data-body-id=back]').first().click();await picker.locator('[data-close]').click();assert.deepEqual((await state()).a,[-20,-15,0]);assert.deepEqual((await state()).b,[0,0,10]);assert.equal(await measure.locator('[data-distance]').textContent(),'26.93 mm');await measure.locator('[data-clear]').click();await page.keyboard.press('Escape');assert.equal(await host.getAttribute('data-point-distance'),null);assert.deepEqual((await save()).features,original);assert.equal(await page.evaluate(()=>window.cadJobs.length),0);assert.deepEqual(errors,[]);
 console.log('PASS reported center-to-corner measurement in face mode, slightly outside corner picking, rear vertex identity, vertex-to-vertex diagonal, point-only candidates, replace B, Esc and unchanged geometry');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
