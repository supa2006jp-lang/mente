import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1800,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.shortcutJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(p,...args){if(p.spec)window.shortcutJobs.push(p.spec.type);return post.call(this,p,...args);};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),canvas=page.locator('#canvas-host canvas'),shortcut=page.locator('#face-extrude-shortcut'),panel=page.locator('#extrude-distance'),picker=page.locator('#selection-candidates');
 const boxes=[{...defaults,id:'a',kind:'extrusion',name:'左の箱',x:-24,width:20,height:20,depth:10},{...defaults,id:'b',kind:'extrusion',name:'右の箱',x:24,width:20,height:20,depth:10}];
 async function load(features,view='top'){
  await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'shortcut.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(250);
 }
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function ready(count=1){await page.waitForFunction(count=>document.getElementById('canvas-host').dataset.extrusionPreviewCount===String(count)&&!document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',count,{timeout:60000});}
 async function confirm(){await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});}
 function checkSolid(features,id,expectedVolume,maxZ){const bodies=rebuild(features);try{const g=bodies.get(id).geometry;g.computeBoundingBox();assert.ok(Math.abs(volume(g)-expectedVolume)<.05);assert.ok(Math.abs(g.boundingBox.max.z-maxZ)<.001);}finally{for(const body of bodies.values())body.geometry.dispose();}}
 async function selectFace(point,add=false){if(add)await page.keyboard.down('Control');await page.mouse.click(...await screen(point));if(add)await page.keyboard.up('Control');await page.waitForTimeout(150);}
 await load(boxes);await page.locator('#selection-mode').selectOption('face');const jobs=await page.evaluate(()=>window.shortcutJobs.length);
 await selectFace([-22,2,10]);await shortcut.waitFor();assert.equal(await shortcut.getAttribute('data-count'),'1');
 const point=await screen([-22,2,10]),icon=await shortcut.boundingBox();assert.ok(Math.hypot(icon.x+17-point[0],icon.y+17-point[1])<100,'icon stays near the selected point');
 assert.equal(await page.evaluate(()=>window.shortcutJobs.length),jobs,'selecting and displaying shortcut runs no CAD operation');
 await page.screenshot({path:'.sites-runtime/face-extrude-shortcut-preview.png'});
 const before=JSON.parse(await host.getAttribute('data-camera-state'));await shortcut.click();await panel.waitFor();await shortcut.waitFor({state:'hidden'});
 const after=JSON.parse(await host.getAttribute('data-camera-state'));assert.ok(after.slice(3).every((v,i)=>Math.abs(v-before[i+3])<1e-6),'opening shortcut preserves orientation and zoom');
 assert.equal(await page.locator('#viewport-operation').inputValue(),'join');await page.locator('#viewport-depth').fill('4');await ready();await confirm();let data=await save();checkSolid(data.features,'a',5600,14);checkSolid(data.features,'b',4000,10);
 const applied=structuredClone(data.features);await page.keyboard.press('Control+z');assert.equal((await save()).features.length,2);await page.keyboard.press('Control+y');assert.deepEqual((await save()).features,applied);
 // All selected planar faces are sent to the existing batch extrusion command.
 await load(boxes);await selectFace([-22,2,10]);await selectFace([26,2,10],true);await shortcut.waitFor();assert.equal(await shortcut.getAttribute('data-count'),'2');await shortcut.click();await panel.waitFor();await page.locator('#viewport-depth').fill('3');await ready(2);await confirm();data=await save();checkSolid(data.features,'a',5200,13);checkSolid(data.features,'b',5200,13);
 // Closed sketch regions use the same shortcut, retaining multiple regions.
 const sketches=boxes.map(f=>({...f,id:'sketch-'+f.id,kind:'sketch',groupId:'g',groupNumber:1,z:0}));await load(sketches);await page.locator('#selection-mode').selectOption('auto');await selectFace([-22,2,0]);await selectFace([26,2,0],true);await shortcut.waitFor();assert.equal(await shortcut.getAttribute('data-count'),'2');await shortcut.click();await panel.waitFor();await page.locator('#viewport-combine').selectOption('separate');await page.locator('#viewport-depth').fill('2');await ready(2);await confirm();data=await save();assert.equal(data.features.filter(f=>f.kind==='extrusion').length,2);
 // Curved walls are not advertised as extrudable; their flat end caps are.
 const cylinder={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:24};await load([cylinder],'front');await page.locator('#selection-mode').selectOption('face');await selectFace([3,-Math.sqrt(144-9),12]);await shortcut.waitFor({state:'hidden'});
 await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(250);await selectFace([3,2,24]);await shortcut.waitFor();
 // Projection follows the camera without recomputing the CAD shape.
 const first=await shortcut.boundingBox(),jobCount=await page.evaluate(()=>window.shortcutJobs.length);if(await picker.isVisible())await picker.locator('[data-close]').click();await page.locator('[data-view=iso]').click();await page.waitForTimeout(250);await shortcut.waitFor();const moved=await shortcut.boundingBox();assert.ok(Math.hypot(first.x-moved.x,first.y-moved.y)>5);assert.equal(await page.evaluate(()=>window.shortcutJobs.length),jobCount);
 // Hidden selection and cleared selection cannot launch stale extrusion.
 await page.locator('#bodies [data-body-id=cylinder] .eye').click();await shortcut.waitFor({state:'hidden'});await page.locator('#bodies [data-body-id=cylinder] .eye').click();await page.keyboard.press('Escape');await shortcut.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);const proof={singleFace:true,nearSelection:true,preserveView:true,batchFaces:true,sketchRegions:true,curvedWallHidden:true,flatCapVisible:true,cameraTracking:true,noSelectionCadJobs:true,hideOnDeselect:true,undoRedo:true,errors};
 console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/face-extrude-shortcut-browser-proof.json',JSON.stringify(proof,null,2));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
