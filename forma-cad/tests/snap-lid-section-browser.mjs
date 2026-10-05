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
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);if(!this.captured){this.captured=true;this.addEventListener('message',e=>{if(e.data.result?.analysis?.sectionSides)window.snapResult=e.data.result;});}return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30},upper={...base,id:'lid',name:'上のボディ',z:30,depth:12};
 async function load(features){await page.locator('#file').setInputFiles({name:'lid.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('snap-lid-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#snap-lid-error').textContent());}}


 async function pendingReady(){await page.waitForFunction(()=>document.getElementById('snap-lid-info').textContent.includes('干渉なし'),null,{timeout:90000});}
 async function project(point){const view=await page.locator('#canvas-host').evaluate(el=>{const r=el.querySelector('canvas').getBoundingClientRect();return {state:JSON.parse(el.dataset.cameraState),clip:JSON.parse(el.dataset.cameraClip),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});const {state,clip,rect}=view,camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const v=new THREE.Vector3(...point).project(camera);return {x:rect.x+(v.x+1)/2*rect.width,y:rect.y+(1-v.y)/2*rect.height};}
 async function clickFace(normal,pose){const result=await page.evaluate(()=>window.snapResult),side=result.analysis.sectionSides.find(s=>s.normal[0]*normal[0]+s.normal[1]*normal[1]>.99);let point=[...side.center,result.analysis.seam+6];if(pose==='print'){const {pivot,translation}=result.analysis.lidPose;point=[point[0]+translation[0],2*pivot[1]-point[1]+translation[1],2*pivot[2]-point[2]+translation[2]];}const at=await project(point);await page.mouse.click(at.x,at.y);await ready();return result;}
 await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();await page.locator('#snap-lid-section').click();const panel=page.locator('#snap-lid-section-panel');assert.ok(await panel.isVisible());assert.equal(await panel.getAttribute('data-focus'),'joint');assert.match(await panel.textContent(),/0.20 mm/);await page.locator('#snap-lid-clearance').fill('0.15');await ready();assert.equal(await panel.getAttribute('data-clearance'),'0.15');
 await page.locator('#snap-lid-openingGroove').check();await ready();await page.locator('[data-snap-focus=opening]').click();assert.equal(await panel.getAttribute('data-focus'),'opening');assert.equal(await panel.getAttribute('data-opening-count'),'2');await page.screenshot({path:'.sites-runtime/snap-lid-section-opening.png'});
 await page.locator('#snap-lid-openingMode').selectOption('single');await ready();assert.equal(await panel.getAttribute('data-opening-count'),'1');assert.match(await page.locator('#snap-lid-opening-info').textContent(),/1か所/);const first=await page.evaluate(()=>window.snapResult.analysis.opening.sides[0]);await page.locator('#snap-lid-openingSide').selectOption('1');await ready();const second=await page.evaluate(()=>window.snapResult.analysis.opening.sides[0]);assert.ok(first.normal[0]*second.normal[0]+first.normal[1]*second.normal[1]<-.99);
 await panel.locator('.snap-section-close').click();await page.locator('#snap-lid-openingMode').selectOption('selected');await pendingReady();assert.ok(await page.locator('#snap-lid-apply').isDisabled());assert.match(await page.locator('#snap-lid-face-status').textContent(),/クリック/);

 const raw=await page.evaluate(()=>window.snapResult),bounds=raw.analysis.bounds,center=[(bounds[0][0]+bounds[1][0])/2,(bounds[0][1]+bounds[1][1])/2],lidPose=raw.analysis.lidPose;
 const innerFloor=[center[0]+lidPose.translation[0],2*lidPose.pivot[1]-center[1]+lidPose.translation[1],2*lidPose.pivot[2]-(raw.analysis.upperMax-2.4)+lidPose.translation[2]],floorAt=await project(innerFloor);await page.mouse.click(floorAt.x,floorAt.y);assert.ok(await page.locator('#snap-lid-apply').isDisabled());assert.match(await page.locator('#snap-lid-error').textContent(),/天井・内面・曲面/);
 const bodyAt=await project([bounds[1][0],center[1],15]);await page.mouse.click(bodyAt.x,bodyAt.y);assert.ok(await page.locator('#snap-lid-apply').isDisabled());assert.match(await page.locator('#snap-lid-error').textContent(),/橙色の蓋/);
 // Current isometric view looks at +X, -Y. A -Y long face on the flipped lid is +Y originally.
 await clickFace([0,1,0],'print');assert.match(await page.locator('#snap-lid-face-status').textContent(),/選択済み/);assert.equal(await page.evaluate(()=>window.snapResult.analysis.opening.sides[0].length),80);
 await page.locator('#snap-lid-section').click();await page.locator('[data-snap-focus=joint]').click();await page.screenshot({path:'.sites-runtime/snap-lid-section-joint.png'});await panel.locator('.snap-section-close').click();
 await page.locator('#snap-lid-pose').selectOption('assembled');await ready();assert.equal(await page.evaluate(()=>window.snapResult.analysis.opening.count),1);await page.locator('#snap-lid-pick-face').click();await pendingReady();await clickFace([1,0,0],'assembled');assert.equal(await page.evaluate(()=>window.snapResult.analysis.opening.sides[0].length),50);
 await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);assert.ok(!await panel.isVisible());const saved=await save();assert.equal(saved.features.at(-1).spec.openingMode,'selected');assert.ok(saved.features.at(-1).spec.openingFace);assert.equal(saved.features.at(-1).analysis.opening.count,1);
 await load(saved.features);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.equal(await page.locator('#snap-lid-openingMode').inputValue(),'selected');assert.match(await page.locator('#snap-lid-face-status').textContent(),/選択済み/);await page.locator('#snap-lid-openingMode').selectOption('both');await ready();await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);assert.equal((await save()).features.at(-1).analysis.opening.count,2);await page.locator('#undo').click();assert.equal((await save()).features.at(-1).analysis.opening.count,1);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).analysis.opening.count,2);assert.deepEqual(errors,[]);console.log('PASS actual section, live dimensions, focus, both/single sides, clicked print and assembled faces, save/reload/reedit and undo/redo');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
