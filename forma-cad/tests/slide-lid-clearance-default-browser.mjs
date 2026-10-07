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
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{await fs.writeFile('.sites-runtime/slide-labels-failed-spec.json',JSON.stringify(await page.evaluate(()=>window.latestSpec)));throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}
 await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();
 assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'2');assert.equal(await page.locator('#slide-lid-railDepth').inputValue(),'2.6');assert.equal(await page.locator('#slide-lid-clearance').getAttribute('max'),'2');
 for(const direction of ['long','short'])for(const entry of ['negative','positive']){
  await page.locator('#slide-lid-direction').selectOption(direction);await page.locator('#slide-lid-entry').selectOption(entry);await ready();await apply();
  const saved=await save(),op=saved.features.at(-1);assert.equal(op.spec.clearance,2);assert.equal(op.spec.railDepth,2.6);assert.equal(op.analysis.clearance,2);assert.ok(op.analysis.engagement>=.6-1e-6);assert.ok(op.analysis.remainingWall>=1.2);assert.equal(op.analysis.overlap,0);assert.equal(op.analysis.slidingOverlap,0);assert.ok(op.analysis.frontClosure.thickness>=1.2);assert.equal(op.outputs.length,2);
  for(const output of op.outputs){const zs=output.vertices.filter((_,i)=>i%3===2);assert.ok(Math.abs(Math.min(...zs))<1e-5,'both print parts rest on Z=0');}
  await load(saved.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'2');assert.equal(await page.locator('#slide-lid-railDepth').inputValue(),'2.6');
  console.log('PASS 2.0 mm clearance, engagement, wall thickness, interference-free sliding, print placement and reload: '+direction+' / '+entry);
  if(direction==='short'&&entry==='positive')break;
  await page.locator('#slide-lid-cancel').click();await load([base]);await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();
 }
 await page.locator('#slide-lid-pose').selectOption('assembled');await ready();await apply();let saved=await save();assert.equal(saved.features.at(-1).spec.clearance,2);assert.equal(saved.features.at(-1).analysis.slidingOverlap,0);
 await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();await page.locator('#slide-lid-clearance').fill('0.25');await page.locator('#slide-lid-railDepth').fill('1.2');await ready();await apply();saved=await save();await load(saved.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.25');assert.equal(await page.locator('#slide-lid-railDepth').inputValue(),'1.2');
 await page.locator('#slide-lid-clearance').fill('2');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('蓋の掛かり'));assert.equal(await page.locator('#slide-lid-apply').isDisabled(),true);
 await page.locator('#slide-lid-clearance').fill('2.05');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('正しい数値'));assert.equal(await page.locator('#slide-lid-apply').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS assembled creation, saved 0.25 mm dimensions preserved and invalid rail engagement/clearance rejected');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
