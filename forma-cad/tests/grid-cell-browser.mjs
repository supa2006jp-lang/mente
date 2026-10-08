import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';
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
 const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),panel=page.locator('#extrude-distance');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:25,height:25,depth:20};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'cell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(120);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function select(point=[9,-7,20]){await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen(point));if(await page.locator('#selection-candidates').isVisible()){await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'上面'}).first().click();await page.locator('#selection-candidates [data-close]').click();}await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');}
 async function cell(point){await page.mouse.click(...await screen(point),{button:'right'});await page.locator('#context-grid-cell-extrude').waitFor();}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 const modelVolume=data=>{const bodies=rebuild(data.features);let v=0;for(const b of bodies.values()){v+=volume(b.geometry);b.geometry.dispose();}return v;};
 async function commit(depth=5){await page.locator('#viewport-depth').fill(String(depth));await page.waitForFunction(()=>!document.querySelector('#extrude-distance [type=submit]').disabled);await page.locator('#extrude-distance [type=submit]').click();await panel.waitFor({state:'hidden',timeout:90000});return save();}
 await load([box]);await select();await cell([5,5,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/100/);await page.locator('#context-grid-cell-extrude').click();await panel.waitFor();assert.equal(await page.locator('#viewport-operation').inputValue(),'join');let data=await commit();assert.ok(Math.abs(modelVolume(data)-(12500+500))<.1,'only one full grid cell is joined, not the entire source face');
 await load([box]);await select();await cell([11,11,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/6.25/);await page.locator('#context-grid-cell-extrude').click();data=await commit();assert.ok(Math.abs(modelVolume(data)-(12500+31.25))<.1,'boundary cell extrudes only its remaining area');await page.locator('#undo').click();assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.ok(Math.abs(modelVolume(await save())-12531.25)<.1);
 const holed={...box,profile:'region',region:{plane:'XY',offset:0,outer:[[-20,-20],[20,-20],[20,20],[-20,20]],holes:[[[2,2],[8,2],[8,8],[2,8]]],area:1564,sourceIds:[]}};
 await load([holed]);await select([12,-7,20]);await cell([1,1,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/64/);await page.locator('#context-grid-cell-extrude').click();data=await commit();assert.ok(Math.abs(modelVolume(data)-(1564*20+64*5))<.2,'hole is retained in cell extrusion');

 const slotted={...holed,region:{...holed.region,holes:[[[4,-2],[6,-2],[6,12],[4,12]]],area:1572}};
 await load([slotted]);await select([12,-7,20]);await cell([1,1,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/80/);await page.locator('#context-grid-cell-extrude').click();data=await commit();assert.ok(Math.abs(modelVolume(data)-(1572*20+80*5))<.2,'both disconnected cell pieces are joined');
 await load([box]);await page.locator('[data-view=right]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([12.5,6,13]));await page.locator('#selection-candidates').waitFor();await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'X＋'}).click();await page.locator('#selection-candidates [data-close]').click();await cell([12.5,5,5]);await page.locator('#context-grid-cell-extrude').click();data=await commit();assert.ok(Math.abs(modelVolume(data)-13000)<.2,'side cell extrudes along the face normal');

 const diagonal={...box,id:'occluder',name:'斜めの遮蔽',profile:'region',region:{plane:'XY',offset:25,outer:[[0,0],[10,0],[0,10]],holes:[],area:50,sourceIds:[]},depth:8};
 await load([box,diagonal]);await select();await cell([8,8,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/50/,'right-click menu reports only the visible half cell');await page.screenshot({path:'.sites-runtime/grid-cell-occluded-preview.png'});await page.locator('#context-grid-cell-extrude').click();assert.equal(await page.locator('#viewport-operation').inputValue(),'join');data=await commit(3);assert.equal(data.features.at(-1).region.area,50);assert.ok(Math.abs(modelVolume(data)-13050)<.1,'solid-hidden half of grid cell is not extruded');assert.ok(data.features.at(-1).region.outer.every(([x,y])=>x+y>=10-1e-6),'extrusion preserves diagonal solid boundary');await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).region.area,50);
 const slopedBase={...box,width:80,height:60},slope=.81234,intercept=-.00001;
 const ridge={...box,id:'ridge',name:'斜めの既存の出っ張り',profile:'region',region:{plane:'XY',offset:20,outer:[[-35,-35*slope+intercept],[35,35*slope+intercept],[35,35*slope+intercept+3],[-35,-35*slope+intercept+3]],holes:[],area:210,sourceIds:[]},depth:5,operation:'join',target:'box'};
 await load([slopedBase,ridge]);const beforeSlope=modelVolume(await save());await select([8,2,20]);await cell([8,2,20]);await page.locator('#context-grid-cell-extrude').click();await page.locator('#viewport-operation').selectOption('join');data=await commit(5);
 const afterSlope=modelVolume(data),addedCells=data.features.slice(2),expectedAdded=addedCells.reduce((sum,f)=>sum+f.region.area*f.depth,0);assert.ok(Math.abs(afterSlope-beforeSlope-expectedAdded)<.02,'only the visible triangular cell pieces are added, preserving the original body');
 function assertSurfaceCoverage(data){const body=rebuild(data.features).get('box'),ray=new THREE.Raycaster(new THREE.Vector3(-20,-20,100),new THREE.Vector3(0,0,-1));body.material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});body.updateMatrixWorld(true);const hits=ray.intersectObject(body);assert.ok(hits.some(h=>Math.abs(h.point.z-20)<.01),'unrelated top face remains present and selectable');body.geometry.dispose();body.material.dispose();}
 assertSurfaceCoverage(data);await page.locator('[data-view=iso]').click();await page.screenshot({path:'.sites-runtime/grid-cell-surface-fixed.png'});await load(data.features);assertSurfaceCoverage(await save());await page.locator('#undo').click();await page.locator('#redo').click();assertSurfaceCoverage(await save());
 await load([box,diagonal]);await select();await page.locator('#new-line').click();await cell([8,8,20]);assert.match(await page.locator('#solid-face-menu').textContent(),/50/,'sketch-mode cell also excludes hidden half');await page.locator('#context-grid-cell-extrude').click();await page.locator('#viewport-operation').selectOption('new');data=await commit();assert.equal(data.features.at(-1).region.area,50);
 await load([box]);await select();await page.locator('#new-line').click();await cell([5,5,20]);await page.keyboard.press('Escape');assert.equal(await page.locator('#sketch-banner').isVisible(),true,'closing menu keeps sketch active');await cell([5,5,20]);await page.locator('#context-grid-cell-extrude').click();await panel.waitFor();assert.equal(await page.locator('#sketch-banner').isVisible(),false);await page.keyboard.press('Escape');assert.equal((await save()).features.length,1,'cancel retains original body');
 await load([box]);await select();const drag=await screen([5,5,20]);await page.mouse.move(...drag);await page.mouse.down({button:'right'});await page.mouse.move(drag[0]+35,drag[1]+20,{steps:5});await page.mouse.up({button:'right'});assert.equal(await page.locator('#context-grid-cell-extrude').count(),0,'right drag remains pan');
 await page.locator('[data-view=bottom]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);await page.mouse.click(...await screen([5,5,20]),{button:'right'});assert.equal(await page.locator('#context-grid-cell-extrude').count(),0,'hidden grid cannot be picked through body');await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS full/clipped/holed cell extrusion, actual joined volume, undo/redo, active sketch, cancel, right drag and occlusion');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
