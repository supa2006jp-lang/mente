import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';

// Moving box X=[0,34], center X=17. Stationary box starts at X=53.
const features=[
 {...defaults,id:'moving',name:'moving',width:34,height:20,depth:10,x:17},
 {...defaults,id:'stationary',name:'stationary',width:20,height:20,depth:10,x:63},
 {...defaults,id:'offaxis',name:'offaxis',width:20,height:10,depth:10,x:58,y:45},
];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 await page.locator('#file').setInputFiles({name:'move-leading-contact.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='3');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 await page.waitForTimeout(150);

 const host=page.locator('#canvas-host'),rect=await page.locator('canvas').boundingBox();
 const cameraState=async()=>JSON.parse(await host.getAttribute('data-camera-state'));
 const project=async world=>{
  const state=await cameraState();
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
  camera.position.fromArray(state);
  camera.quaternion.fromArray(state,3);
  camera.zoom=state[7];
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(...world).project(camera);
  return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
 };
 const start=await project([17,0,10]),oneMillimeter=await project([18,0,10]);
 const pixelsPerMillimeter=oneMillimeter.x-start.x;
 assert.ok(pixelsPerMillimeter>0,'top view must project +X to the right');
 const preview=async()=>JSON.parse(await host.getAttribute('data-move-preview'));
 const moveX=async()=>Number(await page.locator('#move-x').inputValue());
 const assertPreview=async()=>assert.ok(Math.abs((await preview()).position[0]-17-await moveX())<.002,'numeric X input matches the live preview');

 await page.locator('#snap-step').selectOption('10');
 await page.locator('#snap-enabled').check();
 await page.locator('#move-tool').click();
 await page.mouse.click(start.x,start.y);
 assert.equal(await page.locator('#move-apply').isEnabled(),true);
 const cameraBefore=await cameraState();
 const handle={x:start.x+75,y:start.y};
 const dragTo=async distance=>page.mouse.move(handle.x+distance*pixelsPerMillimeter,handle.y,{steps:12});
 await page.mouse.move(handle.x,handle.y);
 await page.mouse.down();

 // Nine pixels misses the weak grid snap; four pixels enters it.
 await dragTo(6-9/pixelsPerMillimeter);
 assert.ok(Math.abs(await moveX()-(6-9/pixelsPerMillimeter))<.25,'grid snap stays weak at nine pixels');
 assert.equal(await host.getAttribute('data-move-grid-snap'),null);
 await dragTo(6-4/pixelsPerMillimeter);
 assert.ok(Math.abs(await moveX()-6)<.03,'positive leading face snaps to grid X=40');
 assert.equal(await host.getAttribute('data-move-grid-snap'),'X=40');
 await assertPreview();

 const offaxisMiss=14-9/pixelsPerMillimeter;
 await dragTo(offaxisMiss);
 assert.ok(Math.abs(await moveX()-offaxisMiss)<.25,'body outside the movement path must not attract the moving face');
 assert.equal(await host.getAttribute('data-move-contact-snap'),null);
 await dragTo(19-9/pixelsPerMillimeter);
 assert.ok(Math.abs(await moveX()-19)<.03,'strong contact snap joins faces at X=53, actual='+await moveX()+', contact='+await host.getAttribute('data-move-contact-snap')+', grid='+await host.getAttribute('data-move-grid-snap'));
 assert.equal(await host.getAttribute('data-move-contact-snap'),'X=53');
 await assertPreview();
 await page.mouse.up();

 const cameraAfter=await cameraState();
 assert.ok(cameraBefore.every((value,i)=>Math.abs(value-cameraAfter[i])<1e-6),'drag must not move the camera');
 await page.locator('#move-x').fill('0');
 await page.mouse.move(handle.x,handle.y);
 await page.mouse.down();
 await dragTo(-10+4/pixelsPerMillimeter);
 assert.ok(Math.abs(await moveX()+10)<.03,'negative leading face snaps to grid X=-10');
 assert.equal(await host.getAttribute('data-move-grid-snap'),'X=-10');
 await assertPreview();
 await page.mouse.up();
 await page.locator('#move-cancel').click();
 assert.deepEqual(errors,[]);
 console.log('PASS directional grid and strong solid-contact snapping, numeric preview, camera stability');
}finally{await browser.close();}
