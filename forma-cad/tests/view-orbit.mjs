import assert from 'node:assert/strict';
import * as THREE from 'three';
import {orbitView} from '../src/view-orbit.js';
import {chromium} from 'playwright';
const start={position:new THREE.Vector3(140,-180,150),target:new THREE.Vector3(25,15,12),up:new THREE.Vector3(0,0,1)};
for(const origin of [false,true]){
 const v=orbitView({...start,origin},70,45),pivot=origin?new THREE.Vector3():start.target;
 assert.ok(Math.abs(v.position.distanceTo(pivot)-start.position.distanceTo(pivot))<1e-8);
 assert.ok(Math.abs(v.position.distanceTo(v.target)-start.position.distanceTo(start.target))<1e-8);
 if(!origin)assert.ok(v.target.distanceTo(start.target)<1e-8);
 const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,10000);
 function projected(view){camera.position.copy(view.position);camera.up.copy(view.up);camera.lookAt(view.target);camera.updateMatrixWorld();return pivot.clone().project(camera);}
 assert.ok(projected(start).distanceTo(projected(v))<1e-8,'Pivot must stay fixed on screen');
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5188');const canvas=page.locator('canvas');await canvas.waitFor();
 const r=await canvas.boundingBox(),x=r.x+r.width*.5,y=r.y+r.height*.5;
 for(const button of ['left','middle']){
  await page.locator('[data-view=iso]').click();
  await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+80,y+60,{steps:8});
  assert.equal(await page.locator('#selection-box').isVisible(),false);
  assert.ok(Number.isFinite(Number(await page.locator('#canvas-host').getAttribute('data-camera-height'))));
  await page.mouse.up({button});await page.keyboard.up('Shift');
 }
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+60,{steps:5});assert.equal(await page.locator('#selection-box').isVisible(),true);await page.mouse.up();
 assert.deepEqual(errors,[]);console.log('PASS Shift left/middle orbit, fixed pivot projection and rectangle selection');
}finally{await browser.close();}
