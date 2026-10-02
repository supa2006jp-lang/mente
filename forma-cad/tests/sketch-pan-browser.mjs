import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {sketchPoints} from '../src/regions.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 await page.goto('http://127.0.0.1:5188');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('閉じた'));

 const host=page.locator('#canvas-host');
 const cameraState=async()=>JSON.parse(await host.getAttribute('data-camera-state'));
 const save=async()=>{
  const download=page.waitForEvent('download');
  await page.locator('#save').click();
  return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 };
 const freeCanvasPoint=async(x,y)=>{
  for(const [dx,dy] of [[180,100],[240,-90],[-220,95],[-160,-140],[100,180],[-100,-180]]){
   const point={x:x+dx,y:y+dy};
   await page.mouse.move(point.x,point.y);
   if(await page.evaluate(([px,py])=>document.elementFromPoint(px,py)===document.querySelector('#canvas-host canvas'),[point.x,point.y]))return point;
  }
  throw Error('A clear sketch canvas point was not found');
 };
 const pan=async(button,x,y,dx,dy)=>{
  const before=await cameraState();
  await page.mouse.move(x,y);
  await page.mouse.down({button});
  await page.mouse.move(x+dx,y+dy,{steps:8});
  await page.mouse.up({button});
  await page.waitForFunction(
   old=>{const next=JSON.parse(document.getElementById('canvas-host').dataset.cameraState||'[]');return Math.hypot(...next.slice(0,3).map((value,i)=>value-old[i]))>1;},
   before
  );
  const after=await cameraState();
  assert.ok(Math.hypot(...after.slice(0,3).map((value,i)=>value-before[i]))>1,button+' drag should pan');
  assert.ok(after.slice(3,7).every((value,i)=>Math.abs(value-before[i+3])<1e-6),button+' drag should not rotate');
  assert.ok(Math.abs(after[7]-before[7])<1e-6,button+' drag should not zoom');
 };

 for(const [plane,buttons] of [['XY',['middle','right']],['XZ',['middle']],['YZ',['right']]]){
  await page.locator('#new-line').click();
  await page.locator('#plane').selectOption(plane);
  await page.locator('#draw').click();
  await page.locator('#continuous-line').uncheck();
  const rect=await page.locator('canvas').boundingBox();
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.click(x,y);
  assert.equal(await page.locator('#feature-count').textContent(),'0');
  assert.equal(await page.locator('#place-line').isEnabled(),true);
  for(const [index,button] of buttons.entries()){
   await pan(button,x+20+index*30,y+15+index*20,95,48);
   assert.equal(await page.locator('#feature-count').textContent(),'0',plane+': pan must not place a sketch');
   assert.equal(await page.locator('#place-line').isEnabled(),true,plane+': first point must remain active');
  }
  const zoomBefore=await cameraState();
  await freeCanvasPoint(x,y);
  await page.mouse.wheel(0,-240);
  await page.waitForFunction(old=>Number(JSON.parse(document.getElementById('canvas-host').dataset.cameraState||'[]')[7])>old,zoomBefore[7]);
  assert.equal(await page.locator('#feature-count').textContent(),'0',plane+': wheel must not place a sketch');
  const end=await freeCanvasPoint(x,y);
  await page.mouse.click(end.x,end.y);
  assert.equal(await page.locator('#feature-count').textContent(),'1',plane+': left click should finish the line');
  const data=await save(),line=data.features.at(-1);
  assert.equal(line.profile,'line');
  assert.equal(line.plane,plane);
  const first=sketchPoints(line)[0];
  assert.ok(Math.hypot(...first)<1e-4,plane+': first point moved during pan: '+first);
  assert.ok(line.width>1,plane+': line must have a nonzero length');
  await page.locator('#clear').click();
  await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='0');
 }

 await page.locator('#new-point').click();
 await page.locator('#plane').selectOption('XY');
 await page.locator('#draw').click();
 const rect=await page.locator('canvas').boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
 await pan('middle',x,y,110,60);
 assert.equal(await page.locator('#feature-count').textContent(),'0','pan must not place a point');
 await page.mouse.click(x+160,y+90);
 assert.equal(await page.locator('#feature-count').textContent(),'1','left click should place one point');
 const data=await save();
 assert.equal(data.features.length,1);
 assert.equal(data.features[0].profile,'point');
 assert.ok(Math.abs(data.features[0].z)<1e-5,'placed point must remain on the XY sketch plane');
 assert.deepEqual(errors,[]);
 console.log('PASS sketch middle/right pan, preserved first point, XY/XZ/YZ drawing, wheel zoom and point placement');
}finally{
 await browser.close();
}
