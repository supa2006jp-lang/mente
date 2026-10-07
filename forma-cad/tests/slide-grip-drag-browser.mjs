import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const prefix='/mente/forma-cad/',root=path.resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!url.startsWith(prefix)){res.writeHead(404);return res.end();}
  let relative=url.slice(prefix.length)||'index.html';if(relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec){window.cadJobs.push(payload.spec.type);window.latestSpec=payload.spec;}return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const base={...defaults,id:'body',kind:'extrusion',name:'長方形',width:80,height:50,depth:30,z:3};
 async function load(features){await page.locator('#file').setInputFiles({name:'slide-widths.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{await page.screenshot({path:'.sites-runtime/slide-grip-failed.png'});await fs.writeFile('.sites-runtime/slide-labels-failed-spec.json',JSON.stringify(await page.evaluate(()=>window.latestSpec)));throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}

 await load([{...base,angle:27}]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();
 await page.locator('#slide-lid-surfaceGripCount').fill('9');await ready();await page.locator('#slide-lid-surfaceGripPitch').fill('4');await ready();assert.match(await page.locator('#slide-lid-surface-info').textContent(),/9本.*間隔 4.00/);
 await page.locator('#slide-lid-surfaceGripPitch').fill('2');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('1.2 mm'));assert.equal(await page.locator('#slide-lid-apply').isDisabled(),true);await page.locator('#slide-lid-surfaceGripPitch').fill('4');await ready();
 await page.locator('#slide-lid-surface-center').click();await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'23.4');assert.equal(await page.locator('#slide-lid-surfaceGripOffsetY').inputValue(),'0');assert.equal(await page.locator('#slide-lid-pose').inputValue(),'print');assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),true);await page.locator('#slide-lid-surfaceGripCount').fill('7');await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'27.4');await page.locator('#slide-lid-surfaceGripCount').fill('9');await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'23.4');await page.locator('#slide-lid-surfaceGripFromFront').fill('3');await ready();assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),false);await page.locator('#slide-lid-surface-move').click();await ready();assert.equal(await page.locator('#slide-lid-pose').inputValue(),'assembled');
 const handle=page.locator('#slide-grip-drag');await handle.waitFor({state:'visible'});
 async function drag(dx,dy,{cancel=false}={}){
  const initial=await page.evaluate(()=>({front:Number(document.getElementById('slide-lid-surfaceGripFromFront').value),y:Number(document.getElementById('slide-lid-surfaceGripOffsetY').value),jobs:window.cadJobs.length}));
  const map=await page.evaluate(()=>{const el=document.getElementById('slide-grip-drag'),box=el.getBoundingClientRect(),pts=document.getElementById('slide-grip-outline').querySelector('polygon').getAttribute('points').split(' ').map(v=>v.split(',').map(Number));return {x:box.x+box.width/2,y:box.y+box.height/2,pts};});
  const t=await page.evaluate(()=>({span:(Number(document.getElementById('slide-lid-surfaceGripCount').value)-1)*Number(document.getElementById('slide-lid-surfaceGripPitch').value)+1.2,width:Number(document.getElementById('slide-lid-surfaceGripLength').value)}));
  const px=(map.pts[1][0]-map.pts[0][0])/t.span*dx+(map.pts[3][0]-map.pts[0][0])/t.width*dy,py=(map.pts[1][1]-map.pts[0][1])/t.span*dx+(map.pts[3][1]-map.pts[0][1])/t.width*dy;
  await page.mouse.move(map.x,map.y);await page.mouse.down();await page.mouse.move(map.x+px,map.y+py,{steps:6});
  const moved=await page.evaluate(()=>({front:Number(document.getElementById('slide-lid-surfaceGripFromFront').value),y:Number(document.getElementById('slide-lid-surfaceGripOffsetY').value),jobs:window.cadJobs.length}));
  assert.equal(moved.jobs,initial.jobs,'no CAD jobs during pointer movement');assert.equal(await page.locator('#slide-lid-apply').isDisabled(),true);
  if(cancel)await handle.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await ready();
  assert.equal(await page.evaluate(()=>window.cadJobs.length),initial.jobs+1,'one CAD update at the end');return {initial,moved};
 }
 let d=await drag(10,4);assert.ok(Math.abs(d.moved.front-d.initial.front-10)<.03);assert.ok(Math.abs(d.moved.y-d.initial.y-4)<.03);assert.match(await page.locator('#slide-lid-surface-info').textContent(),/手前から 13.00.*横 4.00/);
 d=await drag(100,100);assert.ok(d.moved.front<80);assert.ok(d.moved.y<=13);await page.locator('#slide-lid-surfaceGripFromFront').fill('12');await ready();await page.locator('#slide-lid-surfaceGripOffsetY').fill('0');await ready();
 d=await drag(5,2,{cancel:true});assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'12');assert.equal(await page.locator('#slide-lid-surfaceGripOffsetY').inputValue(),'0');
 await page.locator('#slide-lid-entry').selectOption('positive');await ready();d=await drag(3,-2);assert.ok(Math.abs(d.moved.front-d.initial.front-3)<.03);assert.ok(Math.abs(d.moved.y-d.initial.y+2)<.03);
 await page.locator('#slide-lid-direction').selectOption('short');await ready();d=await drag(-2,3);assert.ok(Math.abs(d.moved.front-d.initial.front+2)<.03);assert.ok(Math.abs(d.moved.y-d.initial.y-3)<.03);
 await page.locator('#slide-lid-openAmount').fill('20');assert.equal(await handle.isVisible(),false);await page.locator('#slide-lid-surface-move').click();await handle.waitFor({state:'visible'});assert.equal(await page.locator('#slide-lid-openAmount').inputValue(),'0');
 await page.locator('#slide-lid-surface-center').click();await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'8.4');assert.equal(await page.locator('#slide-lid-surfaceGripOffsetY').inputValue(),'0');await page.locator('#slide-lid-surfaceGripCount').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/slide-grip-drag.png'});await apply();assert.equal(await handle.isVisible(),false);
 const project=await save(),op=project.features.at(-1);assert.equal(op.spec.surfaceGripCentered,true);assert.equal(op.spec.surfaceGripPattern,'transverse');assert.equal(op.spec.surfaceGripCount,9);assert.equal(op.spec.surfaceGripPitch,4);assert.equal(op.analysis.surfaceGrip.count,9);assert.equal(op.analysis.surfaceGrip.pitch,4);const t=op.analysis.surfaceGrip;assert.ok(Math.abs(t.front+t.fromFront+t.span/2-(t.front+t.back)/2)<.006);assert.equal(t.offsetY,0);const savedFront=op.spec.surfaceGripFromFront,savedY=op.spec.surfaceGripOffsetY;
 await load(project.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(Number(await page.locator('#slide-lid-surfaceGripFromFront').inputValue()),savedFront);assert.equal(Number(await page.locator('#slide-lid-surfaceGripOffsetY').inputValue()),savedY);assert.equal(await page.locator('#slide-lid-surfaceGripCount').inputValue(),'9');assert.equal(await page.locator('#slide-lid-surfaceGripPitch').inputValue(),'4');
 assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),true);await page.locator('#slide-lid-surface-move').click();await ready();await handle.waitFor({state:'visible'});d=await drag(3,1,{cancel:true});assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),true);d=await drag(3,1);assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),false);await page.locator('#slide-lid-surface-center').click();await ready();await page.locator('#slide-lid-surfaceGripCount').fill('7');await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'12.4');await page.locator('#slide-lid-surface-center').click();await ready();assert.equal(await page.locator('#slide-lid-surfaceGripFromFront').inputValue(),'12.4');await page.locator('#slide-lid-surface-reset').click();await ready();assert.equal(await page.locator('#slide-lid-surfaceGripCount').inputValue(),'5');assert.equal(await page.locator('#slide-lid-surfaceGripPitch').inputValue(),'0');assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),false);assert.equal(await page.locator('#slide-lid-surfaceGripPattern').inputValue(),'transverse');await page.locator('#slide-lid-cancel').click();assert.deepEqual(errors,[]);console.log('PASS center whole group in print/assembled poses, save/reload, centering after count changes, count/pitch guards, canvas drag in rotated frames and both axes/entries, overflow clamps, no CAD during drag, cancellation, open/close handles, save/reload and reset');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
