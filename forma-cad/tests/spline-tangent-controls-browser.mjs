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
 async function count(n){await page.waitForFunction(n=>document.querySelectorAll('.spline-fit-point').length===n,n);}
 async function save(){await page.waitForTimeout(150);const pending=page.waitForEvent('download');await page.locator('#save').click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
 async function load(features,view='top'){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'tangent.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});try{await page.locator('#project-preview-open').click({timeout:6000});}catch(e){console.log('LOAD ERROR',await page.locator('#status').textContent(),await page.locator('#error').textContent(),errors);await page.screenshot({path:'.sites-runtime/spline-tangent-failure.png'});throw e;}await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('[data-sketch-group] .row-label').first().click();await page.waitForTimeout(100);}
 async function screen(f,p){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const w=worldPoint({...f,offset:planeCoordinates(f).offset},p).project(c);return [r.x+(w.x+1)*r.width/2,r.y+(1-w.y)*r.height/2];}
 async function point(i){const r=await handles.nth(i).boundingBox();return [r.x+r.width/2,r.y+r.height/2];}
 async function openDetails(){const d=page.locator('#spline-tangents');if(!await d.evaluate(el=>el.open))await d.locator('summary').click();}
 async function angle(end,value){await openDetails();const enabled=page.locator('#spline-tangent-'+end+'-enabled');if(!await enabled.isChecked()){await enabled.check();await page.waitForTimeout(200);}const input=page.locator('#spline-tangent-'+end+'-angle');await input.fill(String(value));await input.press('Enter');await page.waitForTimeout(250);}
 async function tangentDrag(end,target,cancel=false){const b=page.locator('.spline-tangent-handle[data-end='+end+']'),r=await b.boundingBox(),view=await host.getAttribute('data-camera-state');await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(...target,{steps:5});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(250);const after=JSON.parse(await host.getAttribute('data-camera-state'));JSON.parse(view).forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-7,'tangent editing preserves the camera'));}

 async function length(end,value){await openDetails();const input=page.locator('#spline-tangent-'+end+'-length');await input.fill(String(value));await input.press('Enter');await page.waitForTimeout(250);}
 async function dragTo(end,target,{cancel=false,alt=false,snapLabel}={}){const b=page.locator('.spline-tangent-handle[data-end='+end+']'),r=await b.boundingBox(),before=JSON.parse(await host.getAttribute('data-camera-state'));await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();if(alt)await page.keyboard.down('Alt');await page.mouse.move(...target,{steps:6});if(snapLabel){await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.splineTangentSnap);assert.match(await host.getAttribute('data-spline-tangent-snap'),snapLabel);}else assert.equal(await host.getAttribute('data-spline-tangent-snap'),null);if(cancel)await page.keyboard.press('Escape');await page.mouse.up();if(alt)await page.keyboard.up('Alt');await page.waitForTimeout(300);JSON.parse(await host.getAttribute('data-camera-state')).forEach((v,i)=>assert.ok(Math.abs(v-before[i])<1e-7));assert.equal(await host.getAttribute('data-spline-tangent-snap'),null);}
 const basic={...defaults,id:'curve',name:'接線調整',kind:'sketch',profile:'spline',points:[[-25,0],[0,20],[25,0]],closed:false,groupId:'g',groupNumber:1};
 // Drawing stores both controls, including snapped/free drag and cancellation.
 await page.locator('#new-spline').click();await page.locator('#snap-enabled').uncheck();const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,positions=[[-160,35],[-50,-60],[150,50]].map(([x,y])=>[cx+x,cy+y]);for(const p of positions){await page.mouse.click(...p);await page.waitForTimeout(80);}await count(3);await angle('start',90);await length('start',4);
 const a=await point(0),p0=await screen(basic,[0,0]),p1=await screen(basic,[1,0]),px=p1[0]-p0[0],target=(degrees,len)=>[a[0]+Math.cos(degrees*Math.PI/180)*len*px,a[1]-Math.sin(degrees*Math.PI/180)*len*px];
 await dragTo('start',target(43,10),{snapLabel:/45°方向/});assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),45);assert.ok(Math.abs(Number(await page.locator('#spline-tangent-start-length').inputValue())-10)<.01);
 await dragTo('start',target(88,15),{cancel:true,snapLabel:/垂直/});assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),45);assert.ok(Math.abs(Number(await page.locator('#spline-tangent-start-length').inputValue())-10)<.01);
 await dragTo('start',target(43,12),{alt:true});assert.ok(Math.abs(Number(await page.locator('#spline-tangent-start-angle').inputValue())-43)<.01);
 await angle('start',17);await length('start',8);assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),17);await page.mouse.move(20,20);await page.keyboard.press('Enter');let project=await save(),draft=project.features[0];assert.equal(draft.tangents.start,17);assert.equal(draft.tangentLengths.start,8);
 // Fixed-angle snapping, physical handle placement, length-only edit and history.
 await load([basic]);await count(3);await angle('start',0);await length('start',6);const endpoint=await point(0),handle=page.locator('.spline-tangent-handle[data-end=start]'),hb=await handle.boundingBox(),expected=await screen(basic,[-19,0]);assert.ok(Math.hypot(hb.x+hb.width/2-expected[0],hb.y+hb.height/2-expected[1])<1,'handle shows actual physical length');
 const targetScreen=async(degrees,len,f=basic,end='start')=>{const pt=end==='start'?f.points[0]:f.points.at(-1),sign=end==='start'?1:-1;return screen(f,[pt[0]+Math.cos(degrees*Math.PI/180)*len*sign,pt[1]+Math.sin(degrees*Math.PI/180)*len*sign]);};
 await dragTo('start',await targetScreen(2,9),{snapLabel:/水平/});project=await save();assert.equal(project.features[0].tangents.start,0);assert.ok(Math.abs(project.features[0].tangentLengths.start-9)<.01);
 const beforeLength=structuredClone(project.features);await length('start',18);project=await save();assert.equal(project.features[0].tangents.start,0);assert.equal(project.features[0].tangentLengths.start,18);assert.deepEqual(project.features[0].points,basic.points);const changed=structuredClone(project.features);
 await page.keyboard.press('Control+z');project=await save();assert.deepEqual(project.features,beforeLength,'numeric length edit is one undo step');await page.keyboard.press('Control+y');project=await save();assert.deepEqual(project.features,changed);
 await load(changed);await count(3);await openDetails();assert.equal(Number(await page.locator('#spline-tangent-start-length').inputValue()),18);
 await page.locator('#spline-tangent-start-reset-length').click();await page.waitForTimeout(250);project=await save();assert.equal(project.features[0].tangents.start,0);assert.equal(project.features[0].tangentLengths?.start,undefined,'reset length retains angle');
 await page.locator('#spline-tangent-snap').uncheck();await dragTo('start',await targetScreen(2,10));project=await save();assert.ok(Math.abs(project.features[0].tangents.start-2)<.01);await page.locator('#spline-tangent-snap').check();
 await angle('end',0);await dragTo('end',await targetScreen(-88,10,basic,'end'),{snapLabel:/垂直/});project=await save();assert.equal(project.features[0].tangents.end,-90);assert.ok(Math.abs(project.features[0].tangentLengths.end-10)<.01);
 // Nearby straight sketches snap with a visible reference and survive reload.
 const reference={...defaults,id:'line',name:'23度の直線',kind:'sketch',mode:'thin',profile:'line',width:22,x:-20,y:2,angle:23,groupId:'g',groupNumber:1};
 await load([basic,reference]);await count(3);await angle('start',0);await dragTo('start',await targetScreen(21,8),{snapLabel:/直線に平行/});project=await save();assert.ok(Math.abs(project.features[0].tangents.start-23)<1e-7);await page.screenshot({path:'.sites-runtime/spline-length-snap.png'});
 await load(project.features);await count(3);await openDetails();assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),23);
 await handles.nth(1).click({button:'right'});await menu.waitFor();await menu.locator('button').hover();assert.ok(await host.getAttribute('data-spline-edit-preview'));await page.keyboard.press('Escape');project=await save();assert.ok(Math.abs(project.features[0].tangentLengths.start-8)<.01,'point preview preserves length');
 // Custom side plane: snap and length updates rebuild dependent geometry.
 const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},side={...basic,plane:'CUSTOM',frame,x:8*Math.SQRT1_2,z:8*Math.SQRT1_2},closing={...side,id:'closing',name:'閉じる線',profile:'polyline',points:[[25,0],[-25,0]]},region=findRegions([side,closing])[0],solid={...defaults,id:'solid',name:'押し出し',kind:'extrusion',profile:'region',region,plane:region.plane,frame:region.frame,x:8*Math.SQRT1_2,z:8*Math.SQRT1_2,depth:6};
 await load([side,closing,solid],'iso');await count(3);await angle('start',90);await length('start',10);project=await save();assert.notEqual(project.features[2].region.area,region.area);assert.deepEqual(project.features[0].frame,frame);const before=structuredClone(project.features);
 await dragTo('start',await targetScreen(43,18,side),{snapLabel:/45°方向/});project=await save();assert.equal(project.features[0].tangents.start,45);assert.ok(Math.abs(project.features[0].tangentLengths.start-18)<.01);assert.notEqual(project.features[2].region.area,before[2].region.area);
 await page.keyboard.press('Control+z');project=await save();assert.deepEqual(project.features,before,'one drag restores direction, length and extrusion');await page.locator('[data-sketch-group] .row-label').first().click();await count(3);await openDetails();await dragTo('start',await targetScreen(12,14,side),{alt:true,cancel:true});project=await save();assert.deepEqual(project.features,before);
 await page.locator('#spline-tangent-start-enabled').uncheck();await page.waitForTimeout(300);project=await save();assert.equal(project.features[0].tangents,undefined);assert.equal(project.features[0].tangentLengths,undefined);assert.ok(Math.abs(project.features[2].region.area-region.area)<1e-6,'automatic reset restores original extrusion');
 assert.deepEqual(errors,[]);console.log('PASS drawing/committed direction snapping, Alt/toggle bypass, physical length, numeric/reset, history, save/reload, nearby lines, custom plane and dependent extrusion');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
