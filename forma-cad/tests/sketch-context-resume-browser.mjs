import {chromium} from 'playwright';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 const lines=[
  {...defaults,kind:'sketch',profile:'line',mode:'thin',id:'first',name:'元の線',groupId:'group-a',groupNumber:1,x:0,y:0,width:60},
  {...defaults,kind:'sketch',profile:'line',mode:'thin',id:'other',name:'別グループ',groupId:'group-b',groupNumber:2,x:0,y:40,width:60}
 ];
 await page.locator('#file').setInputFiles({name:'resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:lines}))});
 await page.locator('#project-preview-open').click();
 await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='2');
 await page.locator('[data-view=top]').click();
 const box=await page.locator('canvas').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 const state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),clip=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-clip')),camera=new THREE.OrthographicCamera(-100*box.width/box.height,100*box.width/box.height,100,-100,...clip);camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const projected=new THREE.Vector3(10,40,0).project(camera),selectedX=box.x+(projected.x+1)*box.width/2,selectedY=box.y+(1-projected.y)*box.height/2;
 await page.mouse.click(selectedX,selectedY);
 await page.waitForFunction(()=>Number(document.getElementById('canvas-host').dataset.selectedSketchCount)===1);
 const cameraBefore=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 await page.mouse.click(selectedX,selectedY,{button:'right'});
 const menu=page.locator('#sketch-group-menu');
 await menu.waitFor();
 assert.match(await menu.textContent(),/このスケッチグループを続きから描く/);
 await page.keyboard.press('Escape');
 assert.equal(await menu.count(),0,'Esc should close the context menu');
 assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド');
 await page.mouse.click(selectedX,selectedY,{button:'right'});
 await menu.waitFor();
 await menu.click();
 assert.equal(await page.locator('#workspace-mode').textContent(),'スケッチ');
 assert.equal(await page.locator('#sketch-banner').isVisible(),true);
 assert.match(await page.locator('#line-dimensions-hint').textContent(),/始点をクリック/);
 await page.waitForTimeout(120);
 const cameraAfter=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 assert.ok(cameraAfter.every((value,i)=>Math.abs(value-cameraBefore[i])<.02),'resuming should preserve camera position and zoom');
 await page.mouse.click(cx+80,cy+120);
 await page.mouse.click(cx+140,cy+120);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#feature-count').textContent(),'3');
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 assert.equal(data.features.at(-1).groupId,'group-b','new line should join the right-clicked group');
 assert.equal(new Set(data.features.map(f=>f.groupId)).size,2);
 assert.ok(Math.abs(data.features.at(-1).y-40)>5,'first point should be chosen anew, away from the selected line');
 await page.mouse.click(selectedX,selectedY);
 await page.waitForFunction(()=>Number(document.getElementById('canvas-host').dataset.selectedSketchCount)===1);
 await page.mouse.move(selectedX,selectedY);
 await page.mouse.down({button:'right'});
 await page.mouse.move(selectedX+60,selectedY+35,{steps:5});
 await page.mouse.up({button:'right'});
 assert.equal(await menu.count(),0,'right-drag panning should not open the sketch menu');
 assert.deepEqual(errors,[]);
 console.log('PASS right-click selected sketch resumes in original group with new start and preserved camera');
}finally{
 await browser.close();
}