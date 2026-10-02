import {chromium} from 'playwright';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1100},acceptDownloads:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 const features=[
  {...defaults,id:'body',name:'円とタブ',profile:'circle',diameter:30,depth:20,x:10},
  {...defaults,id:'tab',name:'接合した四角',operation:'join',target:'body',width:10,height:30,depth:20,x:10,y:20}
 ];
 await page.locator('#file').setInputFiles({name:'circle-tab.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 const rect=await page.locator('canvas').boundingBox();
 const state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
 camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const projected=new THREE.Vector3(10,0,20).project(camera);
 const expected={x:rect.x+(projected.x+1)*rect.width/2,y:rect.y+(1-projected.y)*rect.height/2};
 await page.mouse.move(expected.x,expected.y);
 const marker=page.locator('.center-marker[aria-label="円・円弧の中心を選択"]:visible');
 await marker.waitFor();
 const actual=await marker.evaluate(element=>{const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<3,`center guide must align with analytic circular center (${JSON.stringify({actual,expected})})`);
 await marker.click();
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した円・円弧の中心');
 assert.match(await page.locator('#measurement-length').textContent(),/10.*0.*20/);
 // Start a real point sketch on the top face. The cursor is deliberately offset
 // by a few pixels so the saved coordinates prove center snapping was used.
 await page.locator('#new-point').click();
 await page.locator('#z').fill('20');
 await page.locator('#draw').click();
 const sketchRect=await page.locator('canvas').boundingBox();
 const sketchState=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const sketchCamera=new THREE.OrthographicCamera(-100*sketchRect.width/sketchRect.height,100*sketchRect.width/sketchRect.height,100,-100,.1,100000);
 sketchCamera.position.fromArray(sketchState);sketchCamera.quaternion.fromArray(sketchState,3);sketchCamera.zoom=sketchState[7];sketchCamera.updateProjectionMatrix();sketchCamera.updateMatrixWorld(true);
 const sketchProjection=new THREE.Vector3(10,0,20).project(sketchCamera);
 const sketchTarget={x:sketchRect.x+(sketchProjection.x+1)*sketchRect.width/2,y:sketchRect.y+(1-sketchProjection.y)*sketchRect.height/2};
 await page.mouse.move(sketchTarget.x+3,sketchTarget.y+2);
 await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.snapKind==='center');
 await page.mouse.click(sketchTarget.x+3,sketchTarget.y+2);
 await page.waitForFunction(()=>document.getElementById('sketch-count').textContent==='1');
 const download=page.waitForEvent('download');await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 const placed=saved.features.at(-1);
 assert.equal(placed.profile,'point');
 for(const [key,value] of Object.entries({x:10,y:0,z:20}))assert.ok(Math.abs(placed[key]-value)<1e-3,`${key} should snap to the analytic circle center: ${JSON.stringify(placed)}`);
 // A saved sketch point should render as a round purple glyph rather than a square.
 const point={...defaults,id:'point',name:'点',kind:'sketch',profile:'point',x:12.5,y:7.5,z:0,groupId:'g',groupNumber:1};
 await page.locator('#file').setInputFiles({name:'point.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[point]}))});
 await page.waitForFunction(()=>document.getElementById('sketch-count').textContent==='1');
 await page.locator('[data-view=top]').click();
 await page.waitForTimeout(150);
 const pointRect=await page.locator('canvas').boundingBox(),pointState=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const pointCamera=new THREE.OrthographicCamera(-100*pointRect.width/pointRect.height,100*pointRect.width/pointRect.height,100,-100,.1,100000);
 pointCamera.position.fromArray(pointState);pointCamera.quaternion.fromArray(pointState,3);pointCamera.zoom=pointState[7];pointCamera.updateProjectionMatrix();pointCamera.updateMatrixWorld(true);
 const pointScreen=new THREE.Vector3(point.x,point.y,point.z).project(pointCamera);
 const px=(pointScreen.x+1)*pointRect.width/2,py=(1-pointScreen.y)*pointRect.height/2;
 const png=(await page.locator('canvas').screenshot()).toString('base64');
 const samples=await page.evaluate(async({png,px,py})=>{
  const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const sample=(dx,dy)=>[...ctx.getImageData(Math.round(px)+dx,Math.round(py)+dy,1,1).data];
  return {center:sample(0,0),east:sample(2,0),corner:sample(3,3)};
 },{png,px,py});
 const purple=([r,g,b])=>r>100&&r<220&&g<140&&b>145&&b>r;
 assert.ok(purple(samples.center),`sketch point center should be purple: ${JSON.stringify(samples)}`);
 assert.ok(purple(samples.east),`sketch point interior should remain purple: ${JSON.stringify(samples)}`);
 assert.ok(!purple(samples.corner),`sketch point corner should be transparent, not square: ${JSON.stringify(samples)}`);
 assert.deepEqual(errors,[]);
 console.log('PASS general circle center guide, sketch point snapping to its center, and round purple point');
}finally{await browser.close();}