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
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),panel=page.locator('#extrude-distance'),option=page.locator('#viewport-unextruded-only');
 const sketch={...defaults,id:'sketch',name:'全体のスケッチ',kind:'sketch',width:60,height:40,groupId:'g',groupNumber:1,groupHidden:false};
 const base={...defaults,id:'base',name:'右半分',kind:'extrusion',width:30,height:40,x:15,depth:10};
 async function load(features){
  await page.locator('#file').setInputFiles({name:'partial.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
  await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();
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
 assert.deepEqual(errors,[]);
 console.log('PASS remaining-only controls, preview/cancel/edit, unchanged original, exact output, source completion, undo/redo, reload, partial-history shortcut and empty-area rejection');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
