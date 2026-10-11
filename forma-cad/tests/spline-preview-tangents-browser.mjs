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
 // Drawing: controls adjust the real curve and dragging is cancellable.
 await page.locator('#new-spline').click();await page.locator('#snap-enabled').uncheck();const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,positions=[[-160,35],[-50,-60],[90,20],[160,90]].map(([x,y])=>[cx+x,cy+y]);for(const p of positions)await page.mouse.click(...p);await count(4);
 await angle('start',90);await angle('end',0);await page.screenshot({path:'.sites-runtime/spline-tangents-drawing.png'});
 const endpoint=await point(0);await tangentDrag('start',[endpoint[0]+55,endpoint[1]+30],true);assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),90);
 await page.mouse.move(20,20);await page.keyboard.press('Enter');let project=await save(),open=project.features[0];assert.equal(open.tangents.start,90);assert.equal(open.tangents.end,0);assert.equal(open.points.length,4);
 // Committed hover previews never mutate saved fit points or endpoint directions.
 await handles.nth(1).click({button:'right'});await menu.waitFor();await menu.locator('button').hover();let candidate=JSON.parse(await host.getAttribute('data-spline-edit-preview'));assert.equal(candidate.points.length,3);assert.equal(candidate.deleting,true);assert.equal(await handles.count(),4);
 const poly=page.locator('#spline-effects polyline').nth(1);assert.notEqual(await poly.evaluate(el=>getComputedStyle(el).display),'none');await page.screenshot({path:'.sites-runtime/spline-delete-preview.png'});
 await page.keyboard.press('Escape');assert.equal(await host.getAttribute('data-spline-edit-preview'),null);project=await save();assert.deepEqual(project.features[0],open);
 const sample=sketchPoints(open),insertPoint=sample[Math.floor(sample.length*.5)];await page.mouse.click(...await screen(open,insertPoint),{button:'right'});await menu.waitFor();await menu.locator('button').hover();candidate=JSON.parse(await host.getAttribute('data-spline-edit-preview'));assert.equal(candidate.points.length,5);assert.equal(candidate.deleting,false);assert.deepEqual(candidate.tangents,open.tangents);
 await page.mouse.move(20,20);assert.equal(await host.getAttribute('data-spline-edit-preview'),null,'leave removes ghost');await menu.locator('button').hover();assert.ok(await host.getAttribute('data-spline-edit-preview'));await menu.locator('button').click();await count(5);project=await save();assert.deepEqual(project.features[0].points,candidate.points);assert.deepEqual(project.features[0].tangents,open.tangents);
 await page.keyboard.press('Control+z');project=await save();assert.deepEqual(project.features[0],open,'preview commits as one undo step');
 // Committed tangent edits update geometry, save/reload, undo and reset.
 await page.locator('[data-sketch-group] .row-label').first().click();await count(4);await angle('start',30);project=await save();assert.equal(project.features[0].tangents.start,30);assert.deepEqual(project.features[0].points,open.points);await page.keyboard.press('Control+z');project=await save();assert.equal(project.features[0].tangents.start,90);await page.keyboard.press('Control+y');project=await save();assert.equal(project.features[0].tangents.start,30);
 await load(project.features);await count(4);await openDetails();assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),30);
 const end=await point(3);await tangentDrag('end',[end[0]-50,end[1]-50]);project=await save();assert.ok(Math.abs(project.features[0].tangents.end+45)<.1,'end handle points backwards along the tangent');
 await page.locator('#spline-tangent-start-enabled').uncheck();await page.waitForTimeout(200);project=await save();assert.equal(project.features[0].tangents.start,undefined);assert.equal(await page.locator('.spline-tangent-handle[data-end=start]').isVisible(),false);
 // Side-plane angles are local to the sketch; dependent extrusion rebuilds.
 const source={...defaults,id:'curve',name:'接線テスト',kind:'sketch',profile:'spline',plane:'XZ',x:0,y:8,z:0,points:[[-25,0],[0,20],[25,0]],closed:false,groupId:'g',groupNumber:1},closing={...source,id:'closing',profile:'polyline',points:[[25,0],[-25,0]]},region=findRegions([source,closing])[0],solid={...defaults,id:'solid',name:'押し出し',kind:'extrusion',profile:'region',region,plane:'XZ',y:8,depth:6};
 await load([source,closing,solid],'front');await count(3);await angle('start',90);project=await save();assert.equal(project.features[0].tangents.start,90);assert.notEqual(project.features[2].region.area,region.area);assert.equal(project.features[2].region.sourceIds.includes('curve'),true);const changed=project.features[2].region.area;
 await load(project.features,'front');await count(3);assert.equal(Number(await page.locator('#spline-tangent-start-angle').inputValue()),90);assert.equal((await save()).features[2].region.area,changed);
 const before=(await save()).features;const a=await point(0);await tangentDrag('start',[a[0]+50,a[1]-35],true);project=await save();assert.deepEqual(project.features,before,'Escape restores tangent and dependent geometry');
 // A closed curve hides endpoint controls and ignores retained directions.
 const closed={...source,plane:'XY',y:0,points:[[-20,-15],[20,-15],[20,15],[-20,15]],closed:true,tangents:{start:90,end:0}};await load([closed]);await count(4);assert.equal(await page.locator('#spline-tangents').isVisible(),false);assert.equal(await page.locator('.spline-tangent-handle:visible').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS hover preview cancellation/commit, tangent numeric/drag editing, Escape, undo/redo, save/reload, local side plane and dependent extrusion');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
