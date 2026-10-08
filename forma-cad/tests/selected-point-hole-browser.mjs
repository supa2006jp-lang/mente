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




 async function chooseCenter(point,body,axis){
  await page.mouse.click(...await screen(point));await picker.waitFor();
  const options=picker.locator('[data-kind=faceCenter][data-body-id='+body+']');
  const chosen=options.filter({hasText:axis});assert.equal(await chosen.count(),1);await chosen.click();await picker.locator('[data-close]').click();await page.mouse.move(30,30);
  return JSON.parse(await host.getAttribute('data-selected-point'));
 }
 const button=page.locator('#point-hole'),panel=page.locator('#hole-panel');
 // The selected side center opens an already positioned hole, directed into the owning body.
 await load([back]);await page.locator('[data-view=iso]').click();await page.waitForTimeout(150);
 const original=(await save()).features,ref=await chooseCenter([7,-15,6],'back','Y−');assert.deepEqual(ref.point,[0,-15,5]);
 await button.click();await panel.waitFor();assert.equal(await page.locator('#hole-apply').isEnabled(),true);assert.equal(await page.locator('#hole-diameter').evaluate(el=>document.activeElement===el),true);assert.match(await page.locator('#hole-position').textContent(),/0, -15, 5 mm/);assert.equal(await page.locator('#measurement').isVisible(),false);
 await page.locator('#hole-diameter').fill('6');await page.locator('#hole-depth').fill('4');await page.screenshot({path:'.sites-runtime/selected-point-hole.png'});await page.locator('#hole-cancel').click();assert.deepEqual((await save()).features,original);await page.locator('#selected-point-marker').click();await button.click();await page.locator('#hole-apply').click();await panel.waitFor({state:'hidden'});
 let saved=await save(),hole=saved.features.at(-1);assert.equal(hole.target,'back');assert.deepEqual([hole.x,hole.y,hole.z],ref.point);assert.deepEqual(hole.frame.n,[0,-1,0]);assert.equal(hole.depth,-4);assert.equal(hole.diameter,6);assert.equal(hole.hole,true);
 let bodies=rebuild(saved.features),g=bodies.get('back').geometry;const volume=await import('../src/geometry.js').then(m=>m.volume);assert.ok(Math.abs(volume(g)-(12000-Math.PI*9*4))<2);for(const b of bodies.values())b.geometry.dispose();await page.locator('#undo').click();assert.deepEqual((await save()).features,original);
 // An occluded body's top center is respected, rather than drilling the front body.
 await load([back,front]);const baseline=(await save()).features;await chooseCenter([8,6,30],'back','上面');await button.click();await page.locator('#hole-through').check();await page.locator('#hole-apply').click();await panel.waitFor({state:'hidden'});saved=await save();hole=saved.features.at(-1);assert.equal(hole.target,'back');assert.deepEqual([hole.x,hole.y,hole.z],[0,0,10]);assert.deepEqual(hole.frame.n,[0,0,1]);assert.equal(hole.depth,-10.01);
 bodies=rebuild(saved.features);assert.ok(Math.abs(volume(bodies.get('back').geometry)-(12000-Math.PI*9*10))<2);assert.ok(Math.abs(volume(bodies.get('front').geometry)-12000)<.01);for(const b of bodies.values())b.geometry.dispose();await page.locator('#undo').click();assert.deepEqual((await save()).features,baseline);
 // Bottom face orientation also points inward; Escape cancels without changes.
 await page.mouse.click(...await screen([8,6,30]));await picker.waitFor();const bottom=picker.locator('[data-kind=faceCenter][data-body-id=back]').filter({hasText:'底面'});await bottom.click();await picker.locator('[data-close]').click();await button.click();await panel.waitFor();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.deepEqual((await save()).features,baseline);
 // Vertices do not provide a unique drilling plane.
 await page.locator('#selection-mode').selectOption('auto');await page.mouse.click(...await screen([20,15,30]));await picker.waitFor();await picker.locator('[data-kind=vertex][data-key="front:vertex:20,15,30"]').click();await picker.locator('[data-close]').click();assert.equal(await button.isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS selected side/top/bottom centers to positioned holes, exact normals and target body, blind/through volumes, cancel/Esc/undo, unsupported vertex and no page errors');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
