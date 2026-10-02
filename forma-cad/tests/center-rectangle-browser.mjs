import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {basisFor} from '../src/frames.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 async function project(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));const c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=point.clone().project(c);return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}
 async function save(){const waiting=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await waiting).path(),'utf8'));}
 async function start(plane,centered=true){await page.goto('http://127.0.0.1:5188');await page.locator('#reference-plane').selectOption(plane);await page.locator(centered?'#new-center-rect':'#new-rect').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.sketchViewAlignment==='1');}
 for(const [plane,sx,sy,typed] of [['XY',1,1,false],['XY',-1,1,false],['XY',1,-1,false],['XY',-1,-1,false],['XZ',-1,1,true],['YZ',1,-1,true]]){
  await start(plane);const b=basisFor({plane}),center=b.u.clone().multiplyScalar(10).addScaledVector(b.v,-10),corner=center.clone().addScaledVector(b.u,sx*20).addScaledVector(b.v,sy*15);
  const p=await project(center),q=await project(corner);await page.mouse.click(p.x,p.y);await page.mouse.move(q.x,q.y);await page.waitForTimeout(80);
  assert.equal(await page.locator('#new-center-rect').getAttribute('aria-pressed'),'true');
  await assert.doesNotReject(()=>page.locator('#sketch-draw-instruction').filter({hasText:'中心、角'}).waitFor());
  for(const [i,k] of ['x','y','z'].entries())close(Number(await page.locator('#'+k).inputValue()),center.getComponent(i));
  close(Number(await page.locator('#width').inputValue()),40);close(Number(await page.locator('#height').inputValue()),30);
  close(Number(await page.locator('#sketch-dim-0').inputValue()),40);close(Number(await page.locator('#sketch-dim-1').inputValue()),30);
  const width=typed?28.82:40,height=typed?18.416:30;
  if(typed){await page.locator('#sketch-dim-0').fill(String(width));await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'sketch-dim-1');await page.keyboard.type(String(height));await page.keyboard.press('Enter');}else await page.mouse.click(q.x,q.y);
  const data=await save(),f=data.features.at(-1);assert.equal(f.profile,'rect');assert.equal(f.kind,'sketch');close(f.width,width);close(f.height,height);for(const [i,k] of ['x','y','z'].entries())close(f[k],center.getComponent(i));
  if(plane==='YZ'){await page.locator('#undo').click();assert.equal(await page.locator('#feature-count').textContent(),'0');await page.locator('#redo').click();assert.equal(await page.locator('#feature-count').textContent(),'1');await page.locator('#file').setInputFiles({name:'center-rectangle.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.querySelector('#project-preview-dialog')?.open);const loaded=await save();assert.deepEqual(loaded.features,data.features);}
  console.log('PASS centered '+plane+' quadrant '+sx+','+sy+(typed?' full-size Tab/Enter':''));
 }
 await start('XY',false);const p=await project(new THREE.Vector3(10,-10,0)),q=await project(new THREE.Vector3(30,5,0));await page.mouse.click(p.x,p.y);await page.mouse.move(q.x,q.y);await page.mouse.click(q.x,q.y);const ordinary=(await save()).features[0];close(ordinary.x,20);close(ordinary.y,-2.5);close(ordinary.width,20);close(ordinary.height,15);
 await page.locator('#new-center-rect').click();const r=await project(new THREE.Vector3(0,0,0));await page.mouse.click(r.x,r.y);await page.mouse.move(r.x+80,r.y-60);await page.screenshot({path:'.sites-runtime/center-rectangle.png'});await page.keyboard.press('Escape');assert.equal((await save()).features.length,1);
 assert.deepEqual(errors,[]);console.log('PASS normal rectangle, cancel, undo/redo, save/reload, no page errors');
}finally{await browser.close();}
