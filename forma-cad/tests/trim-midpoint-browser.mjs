import {chromium} from 'playwright';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults} from '../src/geometry.js';
import {sketchPoints} from '../src/regions.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 const arc={...defaults,id:'arc',kind:'sketch',profile:'polyline',name:'円の残り',points:sketchPoints({...defaults,profile:'circle',diameter:20}).slice(0,65),closed:false};
 const line={...defaults,id:'line',kind:'sketch',profile:'line',mode:'thin',name:'横線',width:40,y:6};
 await page.locator('#file').setInputFiles({name:'trim-marker.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[arc,line]}))});
 await page.locator('#project-preview-open').click();await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='2');
 await page.locator('[data-view="top"]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(200);
 const rect=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,.1,100000);
 camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const screen=(x,y)=>{const p=new THREE.Vector3(x,y,0).project(camera);return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};};
 for(const i of [20,26,32,38,44]){const a=arc.points[i],b=arc.points[i+1],p=screen((a[0]+b[0])/2,(a[1]+b[1])/2);await page.mouse.move(p.x,p.y);await page.waitForTimeout(60);assert.equal(await page.locator('.center-marker[aria-label="スケッチ辺の中点を選択"]:visible').count(),0,'arc display chords must not have midpoint buttons');}
 const center=screen(0,6);await page.mouse.move(center.x,center.y);
 await page.locator('.center-marker[aria-label="スケッチ辺の中点を選択"]:visible').waitFor();
 await page.locator('#delete-line-tool').click();await page.mouse.move(center.x,center.y);await page.waitForTimeout(80);
 assert.equal(await page.locator('.center-marker:visible').count(),0,'trim mode hides midpoint, center and intersection buttons');
 assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y).tagName,center),'CANVAS');
 await page.mouse.click(center.x,center.y);await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='3');
 const save=async()=>{const dl=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await dl).path(),'utf8'));};
 let data=await save();const pieces=data.features.filter(f=>f.id!=='arc');assert.equal(pieces.length,2);
 assert.ok(Math.abs(pieces[0].points.at(-1)[0]+8)<.01);assert.ok(Math.abs(pieces[1].points[0][0]-8)<.01);
 const p=screen(5,Math.sqrt(75));await page.mouse.move(p.x,p.y);assert.equal(await page.locator('.center-marker:visible').count(),0);await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='4');data=await save();
 const arcs=data.features.filter(f=>f.name==='円の残り');assert.equal(arcs.length,2);assert.ok(arcs.every(f=>f.points.every(p=>p[1]<=6.001)),'trim removes only upper arc between line intersections');
 await page.keyboard.press('Escape');await page.locator('#undo').click();await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='2');
 await page.mouse.move(center.x,center.y);const midpoint=page.locator('.center-marker[aria-label="スケッチ辺の中点を選択"]:visible');await midpoint.waitFor();await midpoint.click();assert.match(await page.locator('#measurement-title').textContent(),/中点/);
 assert.deepEqual(errors,[]);console.log('PASS saved arc has no following midpoint; trim clicks reach line/arc, save/undo and ordinary midpoint selection');
}finally{await browser.close();}
