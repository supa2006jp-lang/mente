import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';
import {decodeProjectDocument} from '../src/project-codec.js';

const root=path.resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{const file=path.resolve(root,'.'+new URL(req.url==='/'?'/index.html':req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep))throw Error();
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(25000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.addInitScript(()=>{
  window.shortcutJobs=[];window.previewJobs=[];window.heldPreviewJobs=[];window.holdExactPreview=false;
  const post=Worker.prototype.postMessage;
  window.releaseExactPreview=()=>{window.holdExactPreview=false;for(const job of window.heldPreviewJobs.splice(0))post.call(job.worker,job.payload,...job.args);};
  Worker.prototype.postMessage=function(payload,...args){
   if(payload.spec){window.shortcutJobs.push(payload.spec.type);const feature=payload.spec.features?.[0]||payload.spec.feature;
    window.previewJobs.push({type:payload.spec.type,depth:feature?.depth,unextrudedOnly:feature?.unextrudedOnly});
    if(window.holdExactPreview&&payload.spec.type==='exactExtrusionPreview'){window.heldPreviewJobs.push({worker:this,payload,args});return;}
   }
   return post.call(this,payload,...args);
  };
 });
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),panel=page.locator('#extrude-distance'),option=page.locator('#viewport-unextruded-only');
 const sketch={...defaults,id:'sketch',name:'全体のスケッチ',kind:'sketch',width:60,height:40,groupId:'g',groupNumber:1,groupHidden:false};
 const base={...defaults,id:'base',name:'右半分',kind:'extrusion',width:30,height:40,x:15,depth:10};
 async function load(features,view='top'){
  await page.locator('#file').setInputFiles({name:'partial.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
  await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();
  await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchRegionAnalysis!=='pending');
 }
 async function save(){const download=page.waitForEvent('download');await page.locator('#save').click();return (await decodeProjectDocument(await fs.readFile(await(await download).path(),'utf8'))).document;}
 async function screen(point){
  const rect=await page.locator('#canvas-host canvas').boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state')),
   clip=JSON.parse(await host.getAttribute('data-camera-clip')),camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(...point).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];
 }
 async function start(){
  await page.keyboard.down('Alt');await page.mouse.click(...await screen([-18,5,0]));await page.keyboard.up('Alt');
  await page.locator('#solid-tool').click();await panel.waitFor();
  await page.locator('#viewport-operation').selectOption('new');
  await page.locator('#viewport-depth').fill('6');
 }
 async function ready(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1'&&
  !document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',null,{timeout:60000});}
 function checkVolume(document,id,expected){const bodies=rebuild(document.features);try{assert(Math.abs(volume(bodies.get(id).geometry)-expected)<.05);}finally{for(const b of bodies.values()){b.geometry.dispose();b.material.dispose();}}}
 await load([sketch,base]);const initial=await save();
 await fs.mkdir('.sites-runtime/unextruded-extrusion',{recursive:true});
 await page.screenshot({path:'.sites-runtime/unextruded-extrusion/initial.png'});
 await start();assert(!(await option.isChecked()));await option.check();await ready();
 assert.equal(await page.evaluate(()=>window.previewJobs.filter(job=>job.unextrudedOnly&&job.type==='extrusionToolPreview').length),0,'a new remaining-only preview needs no separate tool calculation');
 await page.evaluate(()=>{window.holdExactPreview=true;});
 const fast=await page.evaluate(async()=>{
  const start=performance.now(),input=document.getElementById('viewport-depth');input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));
  const immediate=JSON.parse(document.getElementById('canvas-host').dataset.extrusionFastPreview||'null');
  await new Promise(requestAnimationFrame);return {immediate,frameMs:performance.now()-start};
 });
 assert.equal(fast.immediate.source,'native-tool');assert.deepEqual(fast.immediate.depths,[8]);
 assert(await page.locator('#extrude-distance button[type=submit]').isDisabled(),'a cached tool mesh cannot enable confirmation');
 await page.waitForFunction(()=>window.heldPreviewJobs.length>0);await page.evaluate(()=>window.releaseExactPreview());await ready();
 assert.deepEqual(JSON.parse(await host.getAttribute('data-extrusion-exact-depths')),[8]);
 const rapid=await page.evaluate(()=>[9,12,-4].map(depth=>{const input=document.getElementById('viewport-depth');input.value=String(depth);input.dispatchEvent(new Event('input',{bubbles:true}));return JSON.parse(document.getElementById('canvas-host').dataset.extrusionFastPreview||'null');}));
 assert.deepEqual(rapid.map(item=>item.depths[0]),[9,12,-4]);assert(rapid.every(item=>item.source==='native-tool'));
 await ready();assert.deepEqual(JSON.parse(await host.getAttribute('data-extrusion-exact-depths')),[-4]);
 await page.locator('#viewport-depth').fill('6');await ready();
 console.log(JSON.stringify({nativePreviewFirstFrameMs:Math.round(fast.frameMs),immediateDistanceFeedback:true,noDuplicateToolCalculation:true,commitWaitsForExact:true,latestDistanceWins:true}));
 assert(await page.locator('#unextruded-only').isChecked());assert(await page.locator('#viewport-overlap-only').isDisabled());
 await option.uncheck();assert(!(await page.locator('#unextruded-only').isChecked()));await ready();
 await option.check();await ready();await page.locator('#cancel').click();assert.deepEqual((await save()).features,initial.features);
 await start();await option.check();await ready();
 await fs.mkdir('.sites-runtime/unextruded-extrusion',{recursive:true});
 await page.screenshot({path:'.sites-runtime/unextruded-extrusion/preview.png'});
 await page.locator('#extrude-distance button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});
 const saved=await save(),created=saved.features.at(-1);
 assert.equal(created.unextrudedOnly,true);assert.equal(created.overlapOnly,true);assert.deepEqual(created.overlapTargets,['base']);
 checkVolume(saved,'base',12000);checkVolume(saved,created.id,7200);
 assert.equal(saved.features[0].groupHidden,true);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).features,initial.features);
 await page.keyboard.press('Control+y');checkVolume(await save(),created.id,7200);
 await load(saved.features);checkVolume(await save(),created.id,7200);
 await page.locator('[data-history-feature="'+created.id+'"] button').first().click();
 await panel.waitFor();assert(await option.isChecked());
 await page.locator('#viewport-depth').fill('8');await ready();
 await page.locator('#apply').click();await panel.waitFor({state:'hidden',timeout:60000});
 const edited=await save();checkVolume(edited,created.id,9600);checkVolume(edited,'base',12000);
 assert.equal(edited.features.at(-1).unextrudedOnly,true);
 // Existing partial extrusion history exposes the same one-click workflow.
 const source=structuredClone(created);source.id='partial';source.unextrudedOnly=false;delete source.cadResult;
 await load([sketch,base,source]);
 const row=page.locator('[data-sketch-group=g]');
 assert.equal(await row.getAttribute('data-remaining-region-count'),'1');
 await row.locator('.sketch-remaining-extrude').click();await panel.waitFor();
 assert(await option.isChecked());await page.locator('#cancel').click();
 await load([sketch,{...base,width:60,x:0}]);
 await row.locator('.sketch-remaining-extrude').click();await panel.waitFor();
 await page.waitForFunction(()=>document.getElementById('viewport-depth-error').textContent.includes('未押し出しの部分がありません'),null,{timeout:60000});
 assert(await page.locator('#extrude-distance button[type=submit]').isDisabled());
 assert(await page.locator('#cad-failure-panel').isHidden());
 await page.locator('#cancel').click();assert.equal((await save()).features.length,2);
 // A sketch click offers both actions together; the remainder action starts
 // from the original contour even when the click selected an outside patch.
 await load([sketch,base]);await page.mouse.click(...await screen([-18,5,0]));
 const normalShortcut=page.locator('#face-extrude-shortcut'),remainingShortcut=page.locator('#face-extrude-shortcut-unextruded');
 await normalShortcut.waitFor();await remainingShortcut.waitFor();
 const normalBox=await normalShortcut.boundingBox(),remainingBox=await remainingShortcut.boundingBox();
 assert(Math.abs(normalBox.y-remainingBox.y)<1);assert(remainingBox.x>=normalBox.x+normalBox.width+4);
 const selectionJobs=await page.evaluate(()=>window.shortcutJobs.filter(type=>/extrusion/i.test(type)).length);
 await remainingShortcut.hover();await page.waitForTimeout(150);
 assert.deepEqual(await remainingShortcut.boundingBox(),remainingBox,'the companion stays in place on hover');
 assert.equal(await page.evaluate(()=>window.shortcutJobs.filter(type=>/extrusion/i.test(type)).length),selectionJobs);
 await page.screenshot({path:'.sites-runtime/unextruded-extrusion/shortcuts.png'});
 await remainingShortcut.click();await panel.waitFor();assert(await option.isChecked());assert(await option.isEnabled());
 assert(await remainingShortcut.isHidden());assert(await normalShortcut.isHidden());
 await page.locator('#viewport-depth').fill('4');await ready();
 await page.locator('#extrude-distance button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});
 const direct=await save();assert.equal(direct.features.at(-1).unextrudedOnly,true);
 assert(!direct.features.at(-1).region.overlapSource);checkVolume(direct,direct.features.at(-1).id,4800);checkVolume(direct,'base',12000);
 await load([sketch,base]);await page.mouse.click(...await screen([-18,5,0]));await remainingShortcut.waitFor();
 await remainingShortcut.focus();await page.keyboard.press('Enter');await panel.waitFor();assert(await option.isChecked());
 await page.locator('#cancel').click();
 await load([sketch]);await page.mouse.click(...await screen([-18,5,0]));await remainingShortcut.waitFor();await remainingShortcut.click();
 await panel.waitFor();await page.locator('#viewport-depth').fill('2');await ready();assert(await option.isDisabled());
 await page.locator('#cancel').click();assert.equal((await save()).features.length,1);
 // A rectangle through a box has a covered center and two exposed ends.
 const crossingBody={...base,name:'基準ボディ',width:60,height:30,x:0,depth:24};
 const crossingSketch={...sketch,name:'ボディを横切る長方形',plane:'XZ',width:80,height:8,z:12};
 const crossing=[crossingBody,crossingSketch],overlap=page.locator('#viewport-overlap-only');
 const wholeSketch=page.locator('#viewport-extrude-whole-sketch'),operation=page.locator('#viewport-operation'),depth=page.locator('#viewport-depth');
 await load(crossing,'front');
 assert.equal(await host.getAttribute('data-overlap-region-count'),'3');
 const center=await screen([0,0,12]);
 await page.locator('#solid-tool').click();await page.mouse.move(...center);
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.hoverRegionSide==='inside');
 await page.mouse.click(...center);await panel.waitFor();
 assert(await overlap.isChecked());
 await operation.selectOption('cut');await depth.fill('6');await ready();
 await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});
 const cut=await save();assert.equal(cut.features.at(-1).region.partitionSide,'inside');
 assert.deepEqual(cut.features.at(-1).region.sourceIds,['sketch']);
 checkVolume(cut,'base',60*30*24-60*8*6);

 await load(crossing,'front');await page.mouse.click(...await screen([-35,0,12]));
 await normalShortcut.click();await panel.waitFor();assert(await overlap.isChecked());
 await operation.selectOption('join');await depth.fill('20');await wholeSketch.click();
 assert.equal(await operation.inputValue(),'join');assert.equal(await depth.inputValue(),'20');
 assert(!(await overlap.isChecked()));assert(await wholeSketch.isHidden());
 await ready();await panel.locator('button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});
 const joined=await save();assert.equal(joined.features.at(-1).region.area,80*8);
 assert(!joined.features.at(-1).region.overlapSource);
 checkVolume(joined,'base',60*30*24+80*8*20-60*8*15);

 await load(crossing,'front');await page.keyboard.down('Alt');
 await page.mouse.click(...await screen([0,0,12]));await page.keyboard.up('Alt');
 await normalShortcut.click();await panel.waitFor();
 assert(!(await overlap.isChecked()));assert(await wholeSketch.isHidden());
 await page.locator('#cancel').click();
 console.log('PASS covered sketch picking and cut, full profile join, and Alt selection through a body');

 await load([base]);await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([15,0,10]));
 await normalShortcut.waitFor();assert(await remainingShortcut.isHidden(),'solid faces keep their original extrusion action');
 assert.deepEqual(errors,[]);
 console.log('PASS paired sketch shortcuts, stable hover, no selection CAD jobs, mouse/keyboard entry, whole-source remainder, solid-face exclusion, preview/cancel/edit, exact output, undo/redo, reload and empty-area rejection');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
