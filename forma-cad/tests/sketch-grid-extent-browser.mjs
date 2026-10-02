import {chromium} from 'playwright';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('閉じた'));

 const host=page.locator('#canvas-host');
 const body={...defaults,id:'remote-box',name:'remote box',x:800,y:610,z:0,width:60,height:40,depth:20};
 await page.locator('#file').setInputFiles({
  name:'remote-box.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[body]})),
 });
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.waitForTimeout(300);

 const camera=async()=>{
  const rect=await page.locator('canvas').boundingBox();
  const state=JSON.parse(await host.getAttribute('data-camera-state'));
  const value=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
  value.position.fromArray(state);value.quaternion.fromArray(state,3);value.zoom=state[7];
  value.updateProjectionMatrix();value.updateMatrixWorld(true);
  return {rect,value};
 };
 const project=async point=>{
  const {rect,value}=await camera(),ndc=new THREE.Vector3(...point).project(value);
  assert.ok(Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95,'point outside canvas: '+point);
  return {x:rect.x+(ndc.x+1)*rect.width/2,y:rect.y+(1-ndc.y)*rect.height/2};
 };
 const bounds=async()=>{
  await page.waitForFunction(()=>!!document.getElementById('canvas-host').dataset.sketchGridBounds);
  return JSON.parse(await host.getAttribute('data-sketch-grid-bounds'));
 };
 const visibleBounds=async()=>{
  const {value}=await camera(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-20),points=[];
  for(const u of [-.95,.95])for(const v of [-.95,.95]){
   ray.setFromCamera(new THREE.Vector2(u,v),value);
   const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
   assert.ok(point,'camera must see the selected XY plane');
   points.push(point);
  }
  return {u:[Math.min(...points.map(point=>point.x)),Math.max(...points.map(point=>point.x))],v:[Math.min(...points.map(point=>point.y)),Math.max(...points.map(point=>point.y))]};
 };
 const covers=(grid,area,label)=>{
  for(const axis of ['u','v']){
   assert.ok(grid[axis][0]<=area[axis][0]+1e-3,label+': '+axis+' minimum clipped: '+JSON.stringify({grid,area}));
   assert.ok(grid[axis][1]>=area[axis][1]-1e-3,label+': '+axis+' maximum clipped: '+JSON.stringify({grid,area}));
  }
 };

 const center=await project([body.x,body.y,20]);
 await page.mouse.click(center.x,center.y);
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');
 covers(await bounds(),await visibleBounds(),'selected face');
 await page.screenshot({path:'.sites-runtime/sketch-grid-extent-face.png'});

 // The empty part of the face grid must be clickable beyond the old +/-50-cell limit.
 const empty=await project([body.x+45,body.y,20]);
 await page.mouse.click(empty.x,empty.y);
 assert.match(await page.locator('#measurement-title').textContent(),/面のグリッド/);

 await page.locator('#new-line').click();
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');
 const before=await bounds();
 covers(before,await visibleBounds(),'sketch before pan');

 const rect=await page.locator('canvas').boundingBox();
 const start={x:rect.x+rect.width*.3,y:rect.y+rect.height*.5};
 for(let i=0;i<6;i++){
  await page.mouse.move(start.x,start.y);
  await page.mouse.down({button:'middle'});
  await page.mouse.move(rect.x+rect.width*.7,start.y,{steps:8});
  await page.mouse.up({button:'middle'});
 }
 await page.waitForTimeout(250);
 const after=await bounds();
 assert.notDeepEqual(after,before,'sketch grid range should follow a substantial pan');
 covers(after,await visibleBounds(),'sketch after pan');
 await page.screenshot({path:'.sites-runtime/sketch-grid-extent-pan.png'});
 assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true');
 assert.deepEqual(errors,[]);
 console.log('PASS remote face grid click and view-covering sketch grid before/after pan');
}finally{
 await browser.close();
}