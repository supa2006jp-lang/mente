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
 const boxes=JSON.parse(await fs.readFile('.sites-runtime/extrusion-join-confirm-fixture.forma.json','utf8')).features;
 async function load(features,view='iso'){
  await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'shortcut.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);if(view==='iso')await page.locator('[data-view=iso]').click();else await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(250);
 }
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function ready(count=1){await page.waitForFunction(count=>document.getElementById('canvas-host').dataset.extrusionPreviewCount===String(count)&&!document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',count,{timeout:60000});}
 async function confirm(){await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});}
 function checkSolid(features,id,expectedVolume,maxZ){const bodies=rebuild(features);try{const g=bodies.get(id).geometry;g.computeBoundingBox();assert.ok(Math.abs(volume(g)-expectedVolume)<.05);assert.ok(Math.abs(g.boundingBox.max.z-maxZ)<.001);}finally{for(const body of bodies.values())body.geometry.dispose();}}
 async function selectFace(point,add=false){if(add)await page.keyboard.down('Control');await page.mouse.click(...await screen(point));if(add)await page.keyboard.up('Control');await page.waitForTimeout(150);}

 const dialog=page.locator('#extrusion-join-confirm');
 async function start(input=boxes,{picked=false}={}){
  await load(input);await page.locator('#selection-mode').selectOption('face');await selectFace([4,-4,10]);await shortcut.waitFor();await shortcut.click();await panel.waitFor();await page.locator('#viewport-operation').selectOption('join');await page.locator('#viewport-depth').fill('30');await ready();
  if(picked){await page.waitForTimeout(200);await page.mouse.click(...await screen([4,-4,50]));await page.waitForFunction(()=>JSON.parse(document.getElementById('canvas-host').dataset.extrusionEndPlane||'{}').bodyId==='c');await ready();}
 }
 async function request(){await panel.locator('button[type=submit]').click();await dialog.waitFor();}
 const batchJobs=()=>page.evaluate(()=>window.shortcutJobs.filter(type=>type==='extrusionBatch').length);
 // A declined three-body join leaves the incidental body intact.
 await start(boxes,{picked:true});const beforeJobs=await batchJobs();await request();assert.match(await dialog.textContent(),/3個/);assert.match(await dialog.textContent(),/途中のボディ/);assert.equal(await dialog.locator('[data-join-destination="0"]').inputValue(),'c');assert.equal(await page.locator('#body-count').textContent(),'4');assert.equal(await batchJobs(),beforeJobs,'confirmation reuses the completed join preview');await page.screenshot({path:'.sites-runtime/extrusion-join-confirm-preview.png'});await dialog.locator('[data-no]').click();await panel.waitFor({state:'hidden',timeout:60000});let data=await save(),f=data.features.at(-1);assert.deepEqual(f.targetBodies,['a','c']);assert.equal(f.targetAllBodies,false);assert.deepEqual(f.cadResult.remove,['c']);assert.equal(f.endPlane.bodyId,'c');assert.equal(await page.locator('#body-count').textContent(),'3');let bodies=rebuild(data.features);assert.ok(bodies.has('b'));assert.ok(Math.abs(volume(bodies.get('b').geometry)-1600)<.01);for(const body of bodies.values())body.geometry.dispose();const limited=structuredClone(data.features);await page.keyboard.press('Control+z');assert.equal(await page.locator('#body-count').textContent(),'4');await page.keyboard.press('Control+y');assert.deepEqual((await save()).features,limited);
 // Persisted scope survives file reload and re-edit; expanding it asks again.
 await load(limited);await page.locator('#features .row-label').last().click();await panel.waitFor();assert.equal(await page.locator('#target').inputValue(),'__selected_bodies__');await page.locator('#viewport-target').selectOption('__all_bodies__');await ready();await request();await dialog.locator('[data-yes]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual((await save()).features.at(-1).cadResult.remove.sort(),['b','c']);
 // Yes commits the exact all-body preview without another geometry calculation.
 await start();const yesJobs=await batchJobs();await request();await dialog.locator('[data-yes]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.equal(await batchJobs(),yesJobs);assert.equal(await page.locator('#body-count').textContent(),'2');data=await save();assert.equal(data.features.at(-1).targetAllBodies,true);
 // Numeric distances choose the actual tip contact automatically.
 await start();await request();assert.equal(await dialog.locator('[data-join-destination="0"]').inputValue(),'c');await dialog.locator('[data-no]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.deepEqual((await save()).features.at(-1).targetBodies,['a','c']);
 // Two existing contacts plus the new sweep now require confirmation too.
 await start(boxes.filter(f=>f.id!=='b'));await request();assert.match(await dialog.textContent(),/既存の2個/);assert.equal(await dialog.locator('[data-join-destination="0"]').inputValue(),'c');await dialog.locator('[data-no]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.equal(await page.locator('#body-count').textContent(),'2');
 // Only the source plus the new sweep is below the threshold.
 await start(boxes.filter(f=>f.id!=='b'&&f.id!=='c'));await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.equal(await dialog.count(),0);assert.equal(await page.locator('#body-count').textContent(),'2');
 // A side-only neighbour must remain separate when the user declines.
 const sideBoxes=JSON.parse(await fs.readFile('.sites-runtime/extrusion-join-side-fixture.forma.json','utf8')).features;
 async function startSide(){await load(sideBoxes,'left');await page.locator('#selection-mode').selectOption('face');await selectFace([0,-13,2.5]);await shortcut.waitFor();await shortcut.click();await panel.waitFor();await page.locator('#viewport-operation').selectOption('join');await page.locator('#viewport-depth').fill('10');await ready();}
 await startSide();await request();assert.match(await dialog.textContent(),/既存の2個/);assert.match(await dialog.textContent(),/押し出し元だけを伸ばします/);assert.equal(await dialog.locator('[data-join-destination]').count(),0);await page.screenshot({path:'.sites-runtime/extrusion-join-side-preview.png'});await dialog.locator('[data-no]').click();await panel.waitFor({state:'hidden',timeout:60000});data=await save();assert.deepEqual(data.features.at(-1).targetBodies,['source']);assert.deepEqual(data.features.at(-1).cadResult.remove,[]);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual(data.features[0],sideBoxes[0]);checkSolid(data.features,'source',4000,5);checkSolid(data.features,'floor',4500,5);
 await load(data.features);assert.equal(await page.locator('#body-count').textContent(),'2');
 await startSide();await request();await dialog.locator('[data-yes]').click();await panel.waitFor({state:'hidden',timeout:60000});assert.equal(await page.locator('#body-count').textContent(),'1');
 // Escape cancels the confirmation, preserving the source and editable preview.
 await start();await request();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await panel.isVisible(),true);assert.equal(await page.locator('#body-count').textContent(),'4');assert.equal(await page.locator('#feature-count').textContent(),'4');await request();await dialog.locator('[data-cancel]').click();assert.equal(await panel.isVisible(),true);await page.locator('#viewport-extrude-cancel').click();assert.deepEqual((await save()).features,boxes);
 assert.deepEqual(errors,[]);const proof={thresholdIncludesNewSweep:true,twoExistingBodiesPrompt:true,singleSourceNoPrompt:true,sideContactNoPreservesNeighbour:true,sideContactYesJoins:true,yesAll:true,noSourceAndDestination:true,pickedDestination:true,numericTipDestination:true,incidentalBodyUnchanged:true,reusesPreview:true,cancelAndEscape:true,savedScope:true,reeditConfirmation:true,undoRedo:true,errors};console.log(JSON.stringify(proof));await fs.writeFile('.sites-runtime/extrusion-join-confirm-browser-proof.json',JSON.stringify(proof,null,2));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
