import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';

const root=path.resolve('.'),prefix='/mente/forma-cad/',types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!url.startsWith(prefix))throw Error();let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1150},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);
 const host=page.locator('#canvas-host'),panel=page.locator('#extrude-distance');
 async function save(){const pending=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));}
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'symmetric.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(150);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function ready(count=1){await page.waitForFunction(count=>document.getElementById('canvas-host').dataset.extrusionPreviewCount===String(count)&&!document.getElementById('viewport-depth-error').textContent&&document.getElementById('extrusion-target-status').dataset.state==='valid',count,{timeout:60000});}
 async function confirm(){await page.locator('#extrude-distance button[type=submit]').click();await panel.waitFor({state:'hidden',timeout:60000});}

 const rect={...defaults,id:'r',name:'長方形',kind:'sketch',profile:'rect',width:20,height:10,x:-20,groupId:'g1',groupNumber:1,groupHidden:false},other={...rect,id:'other',x:40,groupId:'g2',groupNumber:2};
 const eye=id=>page.locator('[data-sketch-group="'+id+'"] .eye');
 async function visible(id,value){assert.equal(await eye(id).getAttribute('aria-pressed'),String(value));}
 async function begin(point){await page.mouse.click(...await screen(point));await page.locator('#solid-tool').click();await panel.waitFor();await page.locator('#viewport-depth').fill('3');await ready();}
 await load([rect,other]);const original=(await save()).features;await begin([-18,1,0]);await page.locator('#cancel').click();await visible('g1',true);await visible('g2',true);assert.deepEqual((await save()).features,original,'cancel leaves visibility unchanged');
 await begin([-18,1,0]);await confirm();await visible('g1',false);await visible('g2',true);assert.equal(await page.locator('#region-count').textContent(),'1');let data=await save();assert.equal(data.features[0].groupHidden,true);assert.equal(data.features[1].groupHidden,false);assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).features,original,'one undo restores both extrusion and visibility');await visible('g1',true);await page.keyboard.press('Control+y');await visible('g1',false);await load(data.features);await visible('g1',false);await visible('g2',true);await eye('g1').click();await visible('g1',true);assert.equal(await page.locator('#body-count').textContent(),'1','manual eye restores the sketch without changing the solid');
 // The first extrusion stays visible; save/reload retains completion history.
 const two=[rect,{...rect,id:'r2',x:20}];await load(two);await begin([-18,1,0]);await confirm();await visible('g1',true);assert.equal(await page.locator('#region-count').textContent(),'2');data=await save();await load(data.features);await begin([22,1,0]);await confirm();await visible('g1',false);assert.equal(await page.locator('#body-count').textContent(),'2');
 await page.keyboard.press('Control+z');await visible('g1',true);assert.equal(await page.locator('#body-count').textContent(),'1');await page.keyboard.press('Control+y');await visible('g1',false);data=await save();await load(data.features);await visible('g1',false);await eye('g1').click();await visible('g1',true);
 // A batch that completes every region also hides the source group.
 await load(two);await page.mouse.click(...await screen([-18,1,0]));await page.keyboard.down('Control');await page.mouse.click(...await screen([22,1,0]));await page.keyboard.up('Control');await page.locator('#solid-tool').click();await panel.waitFor();await page.locator('#viewport-combine').selectOption('separate');await page.locator('#viewport-depth').fill('3');await ready(2);await confirm();await visible('g1',false);assert.equal(await page.locator('#body-count').textContent(),'2');
 // Separate line features forming a single rectangle hide the entire group.
 const lines=[[-20,-5,20,0],[-10,0,10,90],[-20,5,20,0],[-30,0,10,90]].map(([x,y,width,angle],i)=>({...rect,id:'l'+i,name:'線'+i,profile:'line',mode:'thin',x,y,width,angle}));await load(lines);await begin([-18,1,0]);await confirm();await visible('g1',false);data=await save();assert.ok(data.features.filter(f=>f.kind==='sketch').every(f=>f.groupHidden));
 // Thin extrusion also retains its source link and hides the source group.
 const line={...rect,id:'line',profile:'line',mode:'thin',y:0};await load([line]);await page.locator('[data-sketch-group] .row-label').first().click();await page.locator('#thin-tool').click();await panel.waitFor();await page.locator('#viewport-depth').fill('3');await ready();await confirm();await visible('g1',false);data=await save();assert.deepEqual(data.features.at(-1).sourceSketchIds,['line']);
 // Exact CAD (taper) follows the same visibility rule after successful creation.
 await load([rect]);await begin([-18,1,0]);await page.locator('#viewport-taper-angle').fill('5');await ready();await confirm();await visible('g1',false);data=await save();assert.ok(data.features.at(-1).cadResult);assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.screenshot({path:'.sites-runtime/extruded-sketch-hidden.png'});assert.deepEqual(errors,[]);
 console.log('PASS extrusion auto-hide: single/multi contours, source-only groups, separate lines, thin source link, exact CAD taper, batch, cancel, manual visibility, atomic undo/redo and save/reload');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
