import {planeCoordinates} from '../src/regions.js';
import {sketchPoints} from '../src/regions.js';
import {worldPoint} from '../src/frames.js';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
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
 const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);
 const host=page.locator('#canvas-host'),handles=page.locator('.spline-fit-point'),menu=page.locator('#spline-point-menu');
 async function count(n){await page.waitForFunction(n=>document.querySelectorAll('.spline-fit-point').length===n,n,{timeout:10000});}
 async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'points.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('[data-sketch-group] .row-label').click();await page.waitForTimeout(100);}
 async function center(i){const r=await handles.nth(i).boundingBox();return [r.x+r.width/2,r.y+r.height/2];}
 async function remove(i,n){await handles.nth(i).click({button:'right'});await menu.waitFor();assert.match(await menu.textContent(),/を削除/);await menu.locator('button').click();await count(n);await page.waitForTimeout(150);}
 async function screen(f,p){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const w=worldPoint({...f,offset:planeCoordinates(f).offset},p).project(c);return [r.x+(w.x+1)*r.width/2,r.y+(1-w.y)*r.height/2];}
 function curvePoint(f,t){const curve=new THREE.CatmullRomCurve3(f.points.map(p=>new THREE.Vector3(...p,0)),!!f.closed,'centripetal'),p=curve.getPoint(t);return [p.x,p.y];}
 async function insertAt(position,n){const camera=await host.getAttribute('data-camera-state');await page.mouse.click(...position,{button:'right'});await menu.waitFor();assert.match(await menu.textContent(),/ここにフィット点を追加/);await menu.locator('button').click();await count(n);await page.waitForTimeout(180);assert.equal(await host.getAttribute('data-camera-state'),camera,'right click editing preserves the camera');}
 await page.locator('#new-spline').click();await page.locator('#snap-enabled').uncheck();const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,positions=[[-160,30],[-70,-90],[90,20],[160,110]].map(([x,y])=>[cx+x,cy+y]);
 async function draw(){for(const p of positions){await page.mouse.click(...p);await page.waitForTimeout(80);}await count(4);}
 await draw();const pixel={points:positions},mid=curvePoint(pixel,.5);
 await page.mouse.click(...mid,{button:'right'});await menu.waitFor();await page.screenshot({path:'.sites-runtime/spline-point-menu.png'});await page.keyboard.press('Escape');assert.equal(await menu.count(),0);assert.equal(await page.locator('#sketch-banner').isVisible(),true,'Escape only dismisses the point menu');await count(4);
 await insertAt(mid,5);await remove(2,4);await remove(1,3);await remove(0,2);await remove(0,1);await remove(0,0);assert.equal(await host.getAttribute('data-spline-preview-points'),'0');
 await draw();await insertAt(mid,5);const inserted=await center(2);assert.ok(Math.hypot(inserted[0]-mid[0],inserted[1]-mid[1])<1,'inserted fit point lies on the curve');
 await page.mouse.move(20,20);await page.keyboard.press('Enter');let project=await save(),open=project.features[0];assert.equal(open.points.length,5);assert.equal(open.closed,false);assert.ok(open.points[2][0]>open.points[1][0]&&open.points[2][0]<open.points[3][0],'point is inserted in order');
 const original=structuredClone(open);await remove(2,4);project=await save();assert.deepEqual(project.features[0].points,[...original.points.slice(0,2),...original.points.slice(3)]);
 await page.keyboard.press('Control+z');project=await save();assert.deepEqual(project.features[0].points,original.points,'point deletion is one undo step');await page.keyboard.press('Control+y');project=await save();assert.equal(project.features[0].points.length,4);
 const group=page.locator('[data-sketch-group] .row-label');await group.click();await count(4);await remove(1,3);await remove(1,2);await handles.first().click({button:'right'});await menu.waitFor();assert.equal(await menu.locator('button').isDisabled(),true);assert.match(await menu.textContent(),/2点以上/);await page.keyboard.press('Escape');await count(2);
 const closed={...defaults,id:'source',name:'閉じた曲線',kind:'sketch',profile:'spline',points:[[-20,-15],[20,-15],[20,15],[-20,15]],closed:true,groupId:'group',groupNumber:1};
 await load([closed]);await count(4);await insertAt(await screen(closed,curvePoint(closed,.875)),5);project=await save();assert.deepEqual(project.features[0].points.slice(0,4),closed.points,'closing segment inserts after the last point');assert.equal(project.features[0].closed,true);
 await remove(4,4);await remove(2,3);await handles.first().click({button:'right'});await menu.waitFor();assert.equal(await menu.locator('button').isDisabled(),true);assert.match(await menu.textContent(),/3点以上/);await page.keyboard.press('Escape');
 // A changed fit-point count still updates dependent extrusion geometry.
 const region=findRegions([closed])[0],solid={...defaults,id:'solid',name:'押し出し',kind:'extrusion',profile:'region',region,depth:6};
 await load([closed,solid]);await count(4);await insertAt(await screen(closed,curvePoint(closed,.375)),5);project=await save();assert.equal(project.features[0].points.length,5);assert.notEqual(project.features[1].region.area,region.area);assert.equal(project.features[1].region.sourceIds[0],'source');await remove(2,4);project=await save();assert.deepEqual(project.features[0].points,closed.points);assert.ok(Math.abs(project.features[1].region.area-region.area)<1e-6,'deletion restores dependent extrusion');
 // Stale menus cannot edit a newly started sketch, and right-drag stays a pan.
 await handles.first().click({button:'right'});await menu.waitFor();await page.locator('#new-spline').click();assert.equal(await menu.count(),0);await count(0);
 await draw();const view=await host.getAttribute('data-camera-state');await page.mouse.move(...mid);await page.mouse.down({button:'right'});await page.mouse.move(mid[0]+45,mid[1]+20,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(150);assert.equal(await menu.count(),0);assert.notEqual(await host.getAttribute('data-camera-state'),view);await count(4);
 assert.deepEqual(errors,[]);await page.screenshot({path:'.sites-runtime/spline-point-edit.png'});console.log('PASS drawing/committed point insertion and deletion, ordering, closed seam, minima, undo/redo, dependent extrusion, menu cancellation and right-drag pan');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
