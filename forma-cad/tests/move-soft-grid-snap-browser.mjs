import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'move-snap.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[{...defaults,id:'b',name:'box',width:30,height:20,depth:10,x:20}]}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.waitForTimeout(150);

 const host=page.locator('#canvas-host');
 const rect=await page.locator('canvas').boundingBox();
 const cameraState=async()=>JSON.parse(await host.getAttribute('data-camera-state'));
 const project=async world=>{
  const state=await cameraState();
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
  camera.position.fromArray(state);
  camera.quaternion.fromArray(state,3);
  camera.zoom=state[7];
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const point=new THREE.Vector3(...world).project(camera);
  return {x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2};
 };
 const center=await project([20,0,10]);
 const towardGrid=await project([24.8,0,10]);
 const towardThirteen=await project([33,0,10]);
 const nearDx=towardGrid.x-center.x,farDx=towardThirteen.x-center.x;
 assert.ok(nearDx>0&&farDx>nearDx,'top view should project +X to the right');
 const preview=async()=>JSON.parse(await host.getAttribute('data-move-preview'));
 const moveX=async()=>Number(await page.locator('#move-x').inputValue());
 const assertInputMatchesPreview=async()=>assert.ok(Math.abs((await preview()).position[0]-20-await moveX())<.002,'numeric X input matches the live preview');

 await page.locator('#snap-step').selectOption('10');
 await page.locator('#snap-enabled').check();
 await page.locator('#move-tool').click();
 await page.mouse.click(center.x,center.y);
 assert.equal(await page.locator('#move-apply').isEnabled(),true);
 const cameraBefore=await cameraState();
 const handle={x:center.x+75,y:center.y};
 await page.mouse.move(handle.x,handle.y);
 await page.mouse.down();
 await page.mouse.move(handle.x+nearDx,handle.y,{steps:10});
 const near=await moveX();
 assert.ok(Math.abs(near-5)<.02,'leading face snaps to the 40 mm grid mark (actual: '+near+')');
 assert.equal(await host.getAttribute('data-move-grid-snap'),'X=40','snap indicator reports the leading face grid line');
 await assertInputMatchesPreview();
 await page.mouse.move(handle.x+farDx,handle.y,{steps:12});
 assert.ok(Math.abs(await moveX()-13)<.25,'drag remains free away from the grid mark');
 assert.equal(await host.getAttribute('data-move-grid-snap'),null,'snap indicator disappears away from the grid line');
 await assertInputMatchesPreview();
 await page.mouse.move(handle.x+nearDx,handle.y,{steps:12});
 assert.ok(Math.abs(await moveX()-5)<.02,'drag snaps again when the leading face nears the grid');
 await page.mouse.up();
 const cameraAfter=await cameraState();
 assert.ok(cameraBefore.every((value,i)=>Math.abs(value-cameraAfter[i])<1e-6),'moving the solid must not move the camera');

 await page.locator('#move-x').fill('0');
 await page.locator('#snap-enabled').uncheck();
 await page.mouse.move(handle.x,handle.y);
 await page.mouse.down();
 await page.mouse.move(handle.x+nearDx,handle.y,{steps:10});
 const unsnapped=await moveX();
 assert.ok(Math.abs(unsnapped-4.8)<.25&&Math.abs(unsnapped-5)>.05,'turning grid snap off leaves the nearby position free');
 assert.equal(await host.getAttribute('data-move-grid-snap'),null,'disabled snapping has no indicator');
 await assertInputMatchesPreview();
 await page.mouse.up();
 await page.locator('#move-cancel').click();
 assert.deepEqual(errors,[]);
 console.log('PASS moving solid leading face softly snaps near 40 mm, moves freely away, respects grid snap toggle, keeps numeric preview and camera in sync');
}finally{await browser.close();}