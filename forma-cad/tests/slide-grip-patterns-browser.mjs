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


 await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();
 assert.equal(await page.locator('#slide-lid-surfaceGripPattern').inputValue(),'transverse');assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),false);
 await page.locator('#slide-lid-surface-center').click();await ready();
 for(const [pattern,name]of [['diagonal','斜め溝'],['grid','格子']]){
  await page.locator('#slide-lid-surfaceGripPattern').selectOption(pattern);await ready();assert.match(await page.locator('#slide-lid-surface-info').textContent(),new RegExp(name));assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),true);
  await page.locator('#slide-lid-surfaceGripCount').fill('7');await ready();await page.locator('#slide-lid-surfaceGripPitch').fill('3');await ready();
  await page.locator('#slide-lid-surface-move').click();await ready();await page.locator('#slide-grip-drag').waitFor({state:'visible'});await page.locator('#slide-lid-surfaceGripPattern').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/slide-grip-'+pattern+'.png'});
  await apply();const project=await save(),op=project.features.at(-1),q=op.analysis.surfaceGrip;assert.equal(op.spec.surfaceGripPattern,pattern);assert.equal(op.spec.surfaceGripCentered,true);assert.equal(q.count,7);assert.ok(Math.abs(q.front+q.fromFront+q.span/2-(q.front+q.back)/2)<1e-8);assert.equal(q.offsetY,0);assert.ok(op.outputs[1].triangles.length>op.outputs[0].triangles.length);
  project.features[0].width=100;await load(project.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-surfaceGripPattern').inputValue(),pattern);assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),true);
  await page.locator('#slide-lid-surfaceGripCount').fill('5');await ready();await page.locator('#slide-lid-surfaceGripPitch').fill('0');await ready();
 }
 await page.locator('#slide-lid-surfaceGripOffsetY').fill('2');await ready();assert.equal(await page.locator('#slide-lid-surfaceGripCentered').isChecked(),false);await apply();const manual=(await save()).features.at(-1);assert.equal(manual.spec.surfaceGripCentered,false);assert.equal(manual.analysis.surfaceGrip.offsetY,2);assert.deepEqual(errors,[]);console.log('PASS pattern selection and actual output meshes, center survives count/pitch changes, source resize/save/reload, saved manual offset releases central mode');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
