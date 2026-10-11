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
 const handles=page.locator('.spline-fit-point'),host=page.locator('#canvas-host');
 async function count(n){try{await page.waitForFunction(n=>document.querySelectorAll('.spline-fit-point').length===n,n,{timeout:10000});}catch(error){await page.screenshot({path:'.sites-runtime/spline-editor-failure.png'});console.log(await page.locator('#spline-point-count').textContent(),errors);throw error;}}
 async function save(){await page.waitForTimeout(150);const pending=page.waitForEvent('download');await page.locator('#save').click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
 async function center(index){const r=await handles.nth(index).boundingBox();assert.ok(r);return [r.x+r.width/2,r.y+r.height/2];}
 async function drag(index,dx,dy,{cancel=false}={}){const a=await center(index),camera=await host.getAttribute('data-camera-state');await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(a[0]+dx,a[1]+dy,{steps:6});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(180);assert.equal(await host.getAttribute('data-camera-state'),camera,'editing points preserves the view');return a;}
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'spline.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);}
 await page.locator('#new-spline').click();await page.locator('#snap-enabled').uncheck();
 const r=await page.locator('canvas').boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,positions=[[-140,35],[-35,-90],[130,25],[35,135]].map(([x,y])=>[cx+x,cy+y]);
 await page.keyboard.press('Backspace');await count(0);
 for(const p of positions.slice(0,3)){await page.mouse.click(...p);await page.waitForTimeout(80);}await count(3);
 await page.keyboard.press('Backspace');await count(2);
 await page.locator('#spline-undo-point').click();await count(1);
 await page.keyboard.press('Backspace');await count(0);assert.equal(await host.getAttribute('data-spline-preview-points'),'0');
 for(const p of positions){await page.mouse.click(...p);await page.waitForTimeout(80);}await count(4);
 await page.locator('#name').fill('自由曲線');await page.locator('#name').press('Backspace');await count(4);await page.locator('#name').fill('自由曲線');await page.locator('#name').blur();
 const before=await center(1);await drag(1,40,22);const after=await center(1);assert.ok(Math.hypot(after[0]-before[0]-40,after[1]-before[1]-22)<1);
 const shot=await page.screenshot(),oldFit=positions[1];
 const stale=await page.evaluate(async({data,point})=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(Math.round(point[0])-3,Math.round(point[1])-3,7,7).data;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<60&&pixels[i+1]>70&&pixels[i+1]<170&&pixels[i+2]>120&&pixels[i+2]<220)return true;return false;},{data:shot.toString('base64'),point:oldFit});
 assert.equal(stale,false,'editing form fields and dragging must not leave a second stale curve');
 const cancelBefore=await center(2);await drag(2,-30,45,{cancel:true});const cancelAfter=await center(2);assert.ok(Math.hypot(cancelBefore[0]-cancelAfter[0],cancelBefore[1]-cancelAfter[1])<1);assert.equal(await page.locator('#sketch-banner').isVisible(),true);
 await page.screenshot({path:'.sites-runtime/spline-editor-drawing.png'});await page.locator('#spline-close').focus();await page.keyboard.press('Enter');await page.waitForTimeout(200);await count(4);assert.equal(await page.locator('#sketch-banner').isVisible(),false);
 let project=await save(),spline=project.features[0];assert.equal(spline.closed,true);assert.equal(spline.points.length,4);assert.equal(findRegions([spline]).length,1,'closed spline forms an extrudable region');
 const committed=structuredClone(spline);await drag(1,32,-17);project=await save();spline=project.features[0];assert.notDeepEqual(spline.points[1],committed.points[1]);assert.deepEqual(spline.points[0],committed.points[0]);assert.equal(spline.closed,true);
 const moved=structuredClone(spline);await page.keyboard.press('Control+z');project=await save();assert.deepEqual(project.features[0].points,committed.points,'one drag is one undo step');
 await page.keyboard.press('Control+y');project=await save();assert.deepEqual(project.features[0].points,moved.points);
 await page.locator('[data-sketch-group] .row-label').first().click();await count(4);
 const unchanged=await save();await drag(2,40,25,{cancel:true});project=await save();assert.deepEqual(project.features[0].points,unchanged.features[0].points,'Escape restores committed fit points');
 await page.locator('#spline-close').click();project=await save();assert.equal(project.features[0].closed,false);await page.locator('#spline-close').click();project=await save();assert.equal(project.features[0].closed,true);
 await page.locator('#new-spline').click();for(const p of positions.slice(0,3)){await page.mouse.click(...p);await page.waitForTimeout(80);}await count(3);
 await handles.first().click();project=await save();assert.equal(project.features.length,2);assert.equal(project.features[1].closed,true);assert.equal(project.features[1].points.length,3,'closing does not insert a duplicate start point');
 // A saved spline on a side plane remains on that plane during drag editing.
 const side={...defaults,id:'side',name:'側面曲線',kind:'sketch',profile:'spline',plane:'YZ',x:12,points:[[-10,-15],[-30,0],[-10,15]],closed:true,groupId:'side-group',groupNumber:1};
 await load([side]);await page.locator('[data-view=right]').dispatchEvent('keydown',{key:'Enter'});await page.locator('[data-sketch-group] .row-label').click();await count(3);await drag(1,30,20);project=await save();assert.equal(project.features[0].plane,'YZ');assert.equal(project.features[0].x,12);assert.notDeepEqual(project.features[0].points[1],side.points[1]);
 // Editing the source also rebuilds a dependent region extrusion.
 const source={...side,id:'source',plane:'XY',x:0,z:0,points:[[-20,-15],[20,-15],[20,15],[-20,15]],groupId:'source-group'},region=findRegions([source])[0],solid={...defaults,id:'solid',name:'曲線押し出し',kind:'extrusion',profile:'region',region,depth:8};
 await load([source,solid]);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('[data-sketch-group] .row-label').click();await count(4);await drag(1,40,0);project=await save();assert.ok(project.features[1].region.area>region.area,'dependent extrusion uses the moved curve');
 const valid=structuredClone(project);await page.locator('#spline-close').click();project=await save();assert.equal(project.features[0].closed,true,'opening a profile required by an extrusion rolls back');assert.deepEqual(project.features[1].region,valid.features[1].region);
 assert.ok(!(await page.locator('#error').textContent()).includes('再計算しています'),'failed replay does not leave a stale loading message');
 await page.screenshot({path:'.sites-runtime/spline-editor.png'});
 const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},tilted={...side,id:'tilted',plane:'CUSTOM',frame,x:12*Math.SQRT1_2,z:12*Math.SQRT1_2};
 await load([tilted]);await page.locator('[data-view=iso]').dispatchEvent('keydown',{key:'Enter'});await page.locator('[data-sketch-group] .row-label').click();await count(3);await drag(1,25,20);project=await save();assert.deepEqual(project.features[0].frame,frame);assert.equal(project.features[0].z,tilted.z);assert.notDeepEqual(project.features[0].points[1],tilted.points[1]);
 // Selecting the curve on the canvas still allows Delete, and the handles clear.
 await page.locator('#spline-handles').evaluate(el=>el.style.pointerEvents='none');
 const edge=sketchPoints(project.features[0])[8],state=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),box=await page.locator('canvas').boundingBox(),camera=new THREE.OrthographicCamera(-100*box.width/box.height,100*box.width/box.height,100,-100,...clip);
 camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const screen=worldPoint({...tilted,offset:12},edge).project(camera);await page.mouse.click(box.x+(screen.x+1)*box.width/2,box.y+(1-screen.y)*box.height/2);await page.keyboard.press('Delete');project=await save();assert.equal(project.features.length,0);await count(0);
 assert.deepEqual(errors,[]);
 console.log('PASS spline point undo/input guard, draw/edit dragging, cancellation, history, both closure paths, saved/reloaded side plane and dependent extrusion rollback');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
