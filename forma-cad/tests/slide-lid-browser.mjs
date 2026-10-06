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
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 const base={...defaults,id:'body',kind:'extrusion',name:'長方形',width:80,height:50,depth:30,z:3},other={...base,id:'other',name:'別のソリッド',width:20,height:20,depth:10,x:130};
 async function load(features){await page.locator('#file').setInputFiles({name:'slide.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('slide-lid-apply').disabled,null,{timeout:90000});}catch{throw Error(await page.locator('#slide-lid-error').textContent());}}
 async function apply(){await page.locator('#slide-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('slide-lid-dialog').open);}
 async function start(){await page.locator('#slide-lid-tool').dispatchEvent('click');await ready();}
 await load([base,other]);await start();assert.equal(await page.locator('#slide-lid-target').inputValue(),'body');assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.25');assert.equal(await page.locator('#slide-lid-wall').inputValue(),'4.2');assert.ok(await page.locator('#slide-lid-openAmount').isDisabled());assert.match(await page.locator('#slide-lid-info').textContent(),/開閉経路とも干渉なし/);assert.equal((await save()).features.length,2,'preview never commits geometry');
 await page.locator('#slide-lid-wall').fill('1.2');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('肉厚'));assert.ok(await page.locator('#slide-lid-apply').isDisabled());await page.locator('#slide-lid-cancel').click();assert.equal((await save()).features.length,2);assert.equal(await page.locator('#bodies .tree-row').count(),2);
 await start();await page.locator('#slide-lid-direction').selectOption('short');await ready();await page.locator('#slide-lid-entry').selectOption('positive');await ready();await page.locator('#slide-lid-grip').uncheck();await ready();await page.locator('#slide-lid-pose').selectOption('assembled');await ready();const jobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#slide-lid-openAmount').fill('50');assert.equal(await page.locator('[data-slide-lid-open]').getAttribute('data-slide-lid-open'),'50');assert.match(await page.locator('#slide-lid-openLabel').textContent(),/50%/);await page.locator('#slide-lid-openAmount').fill('100');await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs,'opening preview only moves the existing lid');await page.locator('#slide-lid-pose').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/slide-lid-preview.png'});await apply();
 const saved=await save(),feature=saved.features.at(-1);assert.equal(feature.spec.type,'slideLid');assert.equal(feature.spec.direction,'short');assert.equal(feature.spec.entry,'positive');assert.equal(feature.spec.grip,false);assert.equal(feature.spec.pose,'assembled');assert.ok(!('openAmount' in feature.spec));assert.equal(feature.outputs.length,2);assert.equal(feature.analysis.slidingOverlap,0);assert.equal(feature.analysis.grip,null);assert.equal(await page.locator('#bodies [data-slide-lid-id]').count(),2);assert.equal(await page.locator('#bodies .tree-row').count(),3);assert.match(await page.locator('#bodies').textContent(),/スライド蓋 本体.*スライド蓋 蓋/);
 const lid=feature.outputs.find(o=>o.id===feature.id+'-lid'),xs=lid.vertices.filter((v,i)=>i%3===0);assert.ok(Math.max(...xs)<40&&Math.min(...xs)>-40,'open preview must save a closed lid');
 await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.type,'slideLid');
 await load(saved.features);await page.locator('#bodies [data-slide-lid-id]').last().click();await ready();assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.25');assert.equal(await page.locator('#slide-lid-entry').inputValue(),'positive');await page.locator('#slide-lid-clearance').fill('0.35');await ready();await page.locator('#slide-lid-pose').selectOption('print');await ready();await page.locator('#slide-lid-grip').check();await ready();await apply();
 const edited=await save(),updated=edited.features.at(-1);assert.equal(updated.id,feature.id);assert.equal(updated.spec.clearance,.35);assert.equal(updated.outputs.length,2);assert.deepEqual(updated.outputs.map(o=>o.id),feature.outputs.map(o=>o.id));assert.equal(updated.spec.pose,'print');assert.ok(updated.analysis.grip);for(const o of updated.outputs){const zs=o.vertices.filter((v,i)=>i%3===2);assert.ok(Math.abs(Math.min(...zs))<1e-5,'print bottoms must be Z=0');}assert.deepEqual(edited.features[1],saved.features[1],'unrelated body is preserved');
 await page.locator('#features .tree-row').last().locator('.row-label').click();await ready();assert.equal(await page.locator('#slide-lid-clearance').inputValue(),'0.35');await page.locator('#slide-lid-cancel').click();assert.equal((await save()).features.at(-1).spec.clearance,.35);
 await load([{...base,profile:'circle',diameter:60}]);await page.locator('#slide-lid-tool').dispatchEvent('click');await page.waitForFunction(()=>document.getElementById('slide-lid-error').textContent.includes('直方体を選択'));assert.ok(await page.locator('#slide-lid-apply').isDisabled());await page.locator('#slide-lid-cancel').click();assert.equal((await save()).features.length,1);
 assert.deepEqual(errors,[]);console.log('PASS auto-shell preview/apply/cancel, dimensions, opposite entrance, long/short sliding, open slider without kernel recomputation, closed save, unrelated body preservation, print placement, reload/reedit, undo/redo and unsupported cylinder');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
