import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.goto('http://127.0.0.1:5188');
 const lines=[
  {...defaults,kind:'sketch',profile:'line',mode:'thin',id:'line-a',name:'線分 A',groupId:'group-a',groupNumber:1,x:-20,y:-10,width:35},
  {...defaults,kind:'sketch',profile:'line',mode:'thin',id:'line-b',name:'線分 B',groupId:'group-a',groupNumber:1,x:25,y:15,width:30,angle:45},
  {...defaults,kind:'sketch',profile:'line',mode:'thin',id:'line-c',name:'線分 C',groupId:'group-b',groupNumber:2,x:70,y:-20,width:25}
 ];
 await page.locator('#file').setInputFiles({name:'lines.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:lines}))});
 await page.waitForFunction(()=>document.getElementById('sketch-count').textContent==='2');
 await page.locator('[data-view=top]').click();
 await page.locator('#fit').click();
 const rect=await page.locator('canvas').boundingBox(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
 await page.mouse.move(cx,cy);
 await page.mouse.wheel(0,-400);
 await page.mouse.down({button:'middle'});
 await page.mouse.move(cx+95,cy+50,{steps:8});
 await page.mouse.up({button:'middle'});
 await page.waitForTimeout(900);
 const camera=async()=>JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state'));
 const expectSameCamera=async(before,label)=>{
  await page.waitForTimeout(100);
  const after=await camera();
  assert.ok(after.every((value,i)=>Math.abs(value-before[i])<.02),label+' changed camera: '+JSON.stringify({before,after}));
 };
 const before=await camera();
 assert.ok(before[7]>1,'test setup should zoom in');
 await page.locator('#sketches [data-sketch-group="group-a"] .row-label').click();
 await expectSameCamera(before,'opening sketch group');
 assert.equal(await page.locator('.sketch-member').count(),2);
 await page.locator('.sketch-member').last().click();
 await expectSameCamera(before,'selecting another line in the group');
 await page.locator('#features .row-label').first().click();
 await expectSameCamera(before,'selecting sketch from history');
 await page.locator('#sketches [data-sketch-group="group-b"] .row-label').click();
 await expectSameCamera(before,'selecting a line in another group');
 await page.locator('#new-line').click();
 await expectSameCamera(before,'reselecting the line tool inside a sketch');
 await page.locator('#select-sketch-edge').click();
 await page.locator('#new-rect').click();
 await expectSameCamera(before,'switching drawing tools inside a sketch');
 await page.keyboard.press('Escape');
 await page.locator('#finish-sketch-tool').click();
 await page.locator('[data-view=iso]').click();
 await page.waitForTimeout(100);
 const modelCamera=await camera();
 await page.locator('#new-line').click();
 await page.waitForTimeout(100);
 const newSketchCamera=await camera();
 assert.ok(Math.hypot(...newSketchCamera.slice(3,7).map((value,i)=>value-modelCamera[i+3]))>.01,'a new sketch should initially align to its plane');
 assert.deepEqual(errors,[]);
 console.log('PASS selecting sketch lines retains zoom and camera position');
}finally{await browser.close();}
