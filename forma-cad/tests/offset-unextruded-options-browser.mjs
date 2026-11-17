import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';
import {decodeProjectDocument} from '../src/project-codec.js';

const root=path.resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{
 const file=path.resolve(root,'.'+new URL(req.url==='/'?'/index.html':req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep))throw Error();
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),panel=page.locator('#extrude-distance'),depth=page.locator('#viewport-depth');
 const sketch={...defaults,id:'sketch',name:'全体',kind:'sketch',width:60,height:40,groupId:'g',groupNumber:1,groupHidden:false};
 const right={...defaults,id:'R',name:'右',kind:'extrusion',width:30,height:40,x:15,depth:10};
 const left={...right,id:'L',name:'左端',x:-25,width:10};
 const simple={...sketch,width:40,height:20};
 async function load(features){
  await page.locator('#file').setInputFiles({name:'options.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);
  await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();
  await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchRegionAnalysis!=='pending');
 }
 async function screen(point){
  const rect=await page.locator('#canvas-host canvas').boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state')),
   clip=JSON.parse(await host.getAttribute('data-camera-clip')),camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(...point).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];
 }
 async function select(point){await page.mouse.click(...await screen(point));}
 async function remaining(){await select([-15,5,0]);await page.locator('#face-extrude-shortcut-unextruded').click();await panel.waitFor();}
 async function ready(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1'&&
  !document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid'&&!document.querySelector('#extrude-distance button[type=submit]').disabled,null,{timeout:60000});}
 async function save(){const download=page.waitForEvent('download');await page.locator('#save').click();return (await decodeProjectDocument(await fs.readFile(await(await download).path(),'utf8'))).document;}
 async function commit(){await ready();await page.locator('#extrude-distance button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});return save();}
 function checkVolume(doc,id,expected){const bodies=rebuild(doc.features);try{assert(Math.abs(volume(bodies.get(id).geometry)-expected)<.05,`volume ${id}: ${volume(bodies.get(id).geometry)} != ${expected}`);}finally{for(const b of bodies.values()){b.geometry.dispose();b.material.dispose();}}}
 async function dimensions(expected){await page.waitForFunction(expected=>{
  const el=document.getElementById('viewport-unextruded-dimensions'),row=JSON.parse(el.dataset.dimensions||'[]')[0];
  return el.dataset.state==='exact'&&row&&Math.abs(row.width-expected[0])<.01&&Math.abs(row.depth-expected[1])<.01&&Math.abs(row.height-expected[2])<.01;
 },expected);}
 await fs.mkdir('.sites-runtime/extrusion-options',{recursive:true});
 await load([sketch,right,left]);await remaining();await depth.fill('6');await ready();await dimensions([20,40,6]);
 await page.locator('#viewport-unextruded-target-mode').selectOption('selected');
 const masks=page.locator('#viewport-unextruded-target-bodies');
 await masks.locator('input[value=L]').uncheck();await ready();await dimensions([30,40,6]);
 await masks.locator('input[value=R]').uncheck();
 await page.waitForFunction(()=>document.getElementById('viewport-depth-error').textContent.includes('1つ以上'));
 assert(await page.locator('#extrude-distance button[type=submit]').isDisabled());
 await masks.locator('input[value=R]').check();await ready();
 await page.screenshot({path:'.sites-runtime/extrusion-options/dimensions.png'});
 const saved=await commit(),created=saved.features.at(-1);assert.equal(created.unextrudedTargetMode,'selected');assert.deepEqual(created.overlapTargets,['R']);checkVolume(saved,created.id,7200);
 const pref=await page.evaluate(()=>JSON.parse(localStorage.getItem('forma-unextruded-preferences-v1')));
 assert.deepEqual(pref.last,{depth:6,symmetric:false,operation:'new'});
 await load(saved.features);await page.locator('[data-history-feature="'+created.id+'"] button').first().click();await panel.waitFor();
 assert.equal(await page.locator('#viewport-unextruded-target-mode').inputValue(),'selected');assert(await masks.locator('input[value=R]').isChecked());assert(!(await masks.locator('input[value=L]').isChecked()));await page.locator('#cancel').click();
 await load([sketch,right,left]);await remaining();assert.equal(Number(await depth.inputValue()),6);assert.equal(await page.locator('#viewport-unextruded-target-mode').inputValue(),'all');
 await depth.fill('7');await page.locator('#viewport-extrusion-direction').selectOption('symmetric');await ready();await dimensions([20,40,14]);await commit();
 await load([sketch,{...right,id:'different-model'}]);await remaining();assert.equal(Number(await depth.inputValue()),7);assert.equal(await page.locator('#viewport-extrusion-direction').inputValue(),'symmetric');
 await depth.fill('9');await page.locator('#cancel').click();await remaining();assert.equal(Number(await depth.inputValue()),7);
 await page.locator('#viewport-unextruded-remember').uncheck();await page.locator('#cancel').click();await remaining();
 assert.equal(await page.locator('#viewport-extrusion-direction').inputValue(),'one');assert(!(await page.locator('#viewport-unextruded-remember').isChecked()));await page.locator('#cancel').click();
 await load([sketch,right]);await remaining();await page.locator('#viewport-unextruded-remember').check();await depth.fill('4');await page.locator('#viewport-operation').selectOption('join');await commit();
 await load([sketch,{...right,id:'another-model'}]);await remaining();assert.equal(Number(await depth.inputValue()),4);assert.equal(await page.locator('#viewport-operation').inputValue(),'join');await page.locator('#cancel').click();
 await load([simple]);await remaining();assert.equal(Number(await depth.inputValue()),4);assert.equal(await page.locator('#viewport-operation').inputValue(),'new');await page.locator('#cancel').click();
 console.log('PASS remaining dimensions, independent mask selection, empty-target guard, save/reedit and successful-settings memory');

 // OS has its own button and numeric modal, without mutating the original sketch.
 await load([simple]);await select([0,0,0]);await page.locator('#face-extrude-shortcut-offset').waitFor();
 assert(await page.locator('#face-extrude-shortcut').isVisible());await page.screenshot({path:'.sites-runtime/extrusion-options/markers.png'});
 await page.locator('#face-extrude-shortcut-offset').click();await page.keyboard.press('Escape');assert.equal((await save()).features.length,1);assert.equal(await host.getAttribute('data-offset-extrusion-preview'),null);
 await select([0,0,0]);
 await page.locator('#face-extrude-shortcut-offset').click();await page.locator('#offset-extrusion-distance').fill('-2');
 const dialog=page.locator('#offset-extrusion-dialog'),position=await dialog.boundingBox(),sourceCorners=[await screen([-20,-10,0]),await screen([20,10,0])],sourceBox={left:Math.min(...sourceCorners.map(p=>p[0])),right:Math.max(...sourceCorners.map(p=>p[0])),top:Math.min(...sourceCorners.map(p=>p[1])),bottom:Math.max(...sourceCorners.map(p=>p[1]))};
 const canvasBox=await page.locator('#canvas-host canvas').boundingBox();await page.screenshot({path:'.sites-runtime/extrusion-options/compact-os-dialog.png'});console.log(JSON.stringify({osInputBounds:position}));assert(position.x>=canvasBox.x&&position.y>=canvasBox.y&&position.x+position.width<=canvasBox.x+canvasBox.width&&position.y+position.height<=canvasBox.y+canvasBox.height,'OS input is inside the drawing canvas');assert(position.width<=251&&position.height<=100,'OS input remains compact');assert.equal(await dialog.locator('#offset-extrusion-cancel').textContent(),'キャンセル');assert.equal(await dialog.locator('button[type=submit]').textContent(),'押出');
 assert(position.x+position.width<=sourceBox.left||position.x>=sourceBox.right||position.y+position.height<=sourceBox.top||position.y>=sourceBox.bottom,'OS input must avoid the selected sketch');
 let guide=JSON.parse(await host.getAttribute('data-offset-extrusion-preview'));assert.equal(guide.distance,-2);assert.equal(guide.offsetRings,1);assert.deepEqual(guide.bounds,[[-18,-8,0],[18,8,0]]);
 await page.locator('#offset-extrusion-distance').fill('2');guide=JSON.parse(await host.getAttribute('data-offset-extrusion-preview'));assert.deepEqual(guide.bounds,[[-22,-12,0],[22,12,0]]);assert.deepEqual(await dialog.boundingBox(),position,'input must stay put while typing');
 await page.locator('#offset-extrusion-distance').fill('-11');assert(await dialog.locator('button[type=submit]').isDisabled());assert.equal(await host.getAttribute('data-offset-extrusion-preview'),null);
 await page.locator('#offset-extrusion-distance').fill('-2');assert(!(await dialog.locator('button[type=submit]').isDisabled()));
 await page.setViewportSize({width:1100,height:800});
 await page.waitForFunction(()=>{const r=document.getElementById('offset-extrusion-dialog').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
 assert.equal(Number(await page.locator('#offset-extrusion-distance').inputValue()),-2);
 await page.setViewportSize({width:1700,height:1150});
 await page.waitForFunction(()=>{const box=document.querySelector('#canvas-host canvas').getBoundingClientRect(),r=document.getElementById('offset-extrusion-dialog').getBoundingClientRect();return r.left>=box.left&&r.top>=box.top&&r.right<=box.right&&r.bottom<=box.bottom;});
 await page.screenshot({path:'.sites-runtime/extrusion-options/os-dialog.png'});await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();
 assert.equal(await host.getAttribute('data-offset-extrusion-preview'),null,'temporary guide is removed before normal extrusion preview');
 assert.equal(Number(await page.locator('#viewport-profile-offset').inputValue()),-2);await depth.fill('3');
 const osSaved=await commit(),os=osSaved.features.at(-1);assert.equal(os.profileOffset,-2);checkVolume(osSaved,os.id,1728);assert.equal(osSaved.features[0].groupHidden,false);assert.equal(osSaved.features[0].width,40);
 await load(osSaved.features);await page.locator('[data-history-feature="'+os.id+'"] button').first().click();await panel.waitFor();
 assert.equal(Number(await page.locator('#viewport-profile-offset').inputValue()),-2);await page.locator('#viewport-profile-offset').fill('-1');await ready();
 await page.locator('#apply').click();await panel.waitFor({state:'hidden',timeout:60000});checkVolume(await save(),os.id,2052);
 await load([simple]);await select([0,0,0]);await page.locator('#face-extrude-shortcut-offset').click();
 assert.equal(Number(await page.locator('#offset-extrusion-distance').inputValue()),-1);await page.locator('#offset-extrusion-distance').fill('');await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();
 assert.equal(Number(await page.locator('#viewport-profile-offset').inputValue()),-1);await page.locator('#cancel').click();assert.equal((await save()).features.length,1);
 await select([0,0,0]);await page.locator('#face-extrude-shortcut-offset').click();await page.locator('#offset-extrusion-distance').fill('2');await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();await depth.fill('3');
 const expanded=await commit();checkVolume(expanded,expanded.features.at(-1).id,3168);
 await load([{...right,width:40,height:20,x:0}]);await select([0,0,10]);await page.locator('#face-extrude-shortcut-offset').click();
 assert.equal(JSON.parse(await host.getAttribute('data-offset-extrusion-preview')).bounds[0][2],10,'solid face guide stays on its selected plane');
 await page.locator('#offset-extrusion-distance').fill('-2');await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();await depth.fill('-3');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='cut');await ready();await depth.fill('3');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='join');await ready();
 const joined=await commit();assert.equal(joined.features.at(-1).profileOffset,-2);checkVolume(joined,'R',9728);
 await load(joined.features);await select([0,0,13]);await page.locator('#face-extrude-shortcut-offset').click();await page.locator('#offset-extrusion-distance').fill('-2');await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();await depth.fill('-2');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='cut');await ready();
 await page.locator('#viewport-operation').selectOption('new');await depth.fill('-1');await ready();assert.equal(await page.locator('#viewport-operation').inputValue(),'new','explicit operation choice remains authoritative');await page.locator('#cancel').click();
 await select([0,0,13]);await page.locator('#face-extrude-shortcut-offset').click();await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();await depth.fill('-2');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='cut');const cut=await commit();assert.equal(cut.features.at(-1).operation,'cut');checkVolume(cut,'R',8960);
 const hollowRegion={id:'hollow',plane:'XY',offset:0,outer:[[-20,-10],[20,-10],[20,10],[-20,10]],holes:[[[-19,-9],[-19,9],[19,9],[19,-9]]],sourceIds:[],area:116};
 await load([{...right,id:'hollow',name:'中空ボディ',x:0,profile:'region',region:hollowRegion}]);await page.locator('#selection-mode').selectOption('face');await select([19.5,0,10]);await page.locator('#face-extrude-shortcut-offset').click();
 await page.locator('#offset-extrusion-distance').fill('-2');const hollowGuide=JSON.parse(await host.getAttribute('data-offset-extrusion-preview'));assert.equal(hollowGuide.sourceRings,1);assert.equal(hollowGuide.offsetRings,1);assert.deepEqual(hollowGuide.bounds,[[-18,-8,10],[18,8,10]]);
 await page.screenshot({path:'.sites-runtime/extrusion-options/hollow-os-dialog.png'});await page.locator('#offset-extrusion-distance').press('Enter');await panel.waitFor();
 assert(await page.locator('#viewport-cap-holes').isChecked());await depth.fill('-3');await ready();assert.equal(await page.locator('#viewport-operation').inputValue(),'new','moving through the cavity is not a cut');
 await page.locator('#viewport-profile-offset').fill('0');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='cut');await ready();await page.locator('#viewport-profile-offset').fill('-2');await page.waitForFunction(()=>document.getElementById('viewport-operation').value==='new');await ready();
 await depth.fill('3');const hollowSaved=await commit(),hollowAdded=hollowSaved.features.at(-1);assert.equal(hollowAdded.capHoles,true);checkVolume(hollowSaved,hollowAdded.id,1728);checkVolume(hollowSaved,'hollow',1160);
 assert.deepEqual(errors,[]);console.log('PASS OS sketch/face buttons, negative/positive footprint, blank previous value, cancel, native volumes, save/reedit and face join');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
