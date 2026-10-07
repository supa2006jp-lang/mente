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






 const panel=page.locator('#extrude-distance'),direction=page.locator('#viewport-side'),wall=page.locator('#viewport-wall');
 async function load(features,{edit=true}={}){await page.locator('#file').setInputFiles({name:'thin.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();if(edit){await page.locator('#features .row-label').last().click();await panel.waitFor({state:'visible'});}await page.locator('[data-view=top]').dispatchEvent('click');}
 async function save(){const download=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));}
 async function commit(){await page.waitForFunction(()=>!document.querySelector('#extrude-distance [type=submit]').disabled);await page.locator('#extrude-distance [type=submit]').click();await panel.waitFor({state:'hidden'});return save();}
 async function tip(text){await page.waitForFunction(expected=>document.getElementById('extrusion-tip-size').textContent.includes(expected),text);}
 const rect={...defaults,id:'rect',name:'薄い長方形',kind:'extrusion',profile:'rect',width:40,height:30,mode:'thin',wall:2,side:'inside',depth:8};
 await load([rect]);await direction.waitFor({state:'visible'});assert.equal(await direction.inputValue(),'inside');assert.equal(await wall.inputValue(),'2');await tip('幅 40 × 奥行き 30');await tip('内寸：幅 36 × 奥行き 26');
 await direction.selectOption('outside');assert.equal(await page.locator('#side').inputValue(),'outside');await tip('幅 44 × 奥行き 34');await tip('内寸：幅 40 × 奥行き 30');
 await wall.fill('3');assert.equal(await page.locator('#wall').inputValue(),'3');await tip('幅 46 × 奥行き 36');await tip('内寸：幅 40 × 奥行き 30');
 await page.locator('#side').selectOption('center');await page.waitForFunction(()=>document.getElementById('viewport-side').value==='center');await tip('幅 43 × 奥行き 33');await tip('内寸：幅 37 × 奥行き 27');
 await page.locator('#wall').fill('2.5');await page.waitForFunction(()=>document.getElementById('viewport-wall').value==='2.5');await tip('幅 42.5 × 奥行き 32.5');await tip('内寸：幅 37.5 × 奥行き 27.5');
 await wall.fill('');assert.equal(await page.locator('#wall').inputValue(),'');await page.waitForFunction(()=>document.querySelector('#extrude-distance [type=submit]').disabled);await wall.fill('3');await tip('幅 43 × 奥行き 33');
 await direction.selectOption('outside');await tip('幅 46 × 奥行き 36');await page.screenshot({path:'.sites-runtime/thin-extrusion-controls.png'});
 let project=await commit(),f=project.features.at(-1);assert.equal(f.mode,'thin');assert.equal(f.side,'outside');assert.equal(f.wall,3);
 await load(project.features);assert.equal(await direction.inputValue(),'outside');assert.equal(await wall.inputValue(),'3');await tip('内寸：幅 40 × 奥行き 30');await direction.selectOption('inside');await tip('幅 40 × 奥行き 30');project=await commit();assert.equal(project.features.at(-1).side,'inside');
 await load([{...rect,id:'taper',name:'テーパー付きの薄い長方形'}]);await page.locator('#viewport-taper-angle').fill('4');await tip('内寸：幅 34.88 × 奥行き 24.88');await tip('外寸：幅 41.12 × 奥行き 31.12');await page.locator('#viewport-taper-angle').fill('-4');await tip('内寸：幅 37.12 × 奥行き 27.12');await tip('外寸：幅 38.88 × 奥行き 28.88');await page.screenshot({path:'.sites-runtime/thin-extrusion-dimensions.png'});await page.locator('#viewport-extrude-cancel').click();
 await load([{...rect,id:'circle',name:'薄い円',profile:'circle',diameter:40,depth:-8}]);await direction.selectOption('outside');await tip('外径 44');await tip('内径 40');await direction.selectOption('center');await tip('外径 42');await tip('内径 38');assert.equal(await page.locator('#viewport-depth').inputValue(),'-8');project=await commit();assert.equal(project.features.at(-1).side,'center');assert.equal(project.features.at(-1).depth,-8);
 await load([{...rect,id:'line',name:'薄い線',profile:'line'}]);await tip('内寸：なし（開いた線）');assert.deepEqual(await direction.locator('option').allTextContents(),['左側','右側','中心（両側に半分ずつ）']);await direction.selectOption('outside');assert.equal(await page.locator('#side').inputValue(),'outside');project=await commit();assert.equal(project.features.at(-1).side,'outside');
 await load([{...rect,id:'solid',mode:'solid'}]);assert.equal(await page.locator('#viewport-thin-fields').isVisible(),false);await commit();
 // Start a fresh thin extrusion from a rectangular sketch, as in the user's flow.
 await load([{...rect,id:'sketch',kind:'sketch',mode:'solid',name:'スケッチ1'}],{edit:false});await page.locator('#thin-tool').click();const canvas=await page.locator('canvas').boundingBox();await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await panel.waitFor({state:'visible'});await direction.waitFor({state:'visible'});await direction.selectOption('outside');await wall.fill('2');await tip('幅 44 × 奥行き 34');await tip('内寸：幅 40 × 奥行き 30');project=await commit();assert.equal(project.features.at(-1).profile,'region');assert.equal(project.features.at(-1).side,'outside');assert.equal(project.features.at(-1).wall,2);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS real inner/outer dimensions and floating inside/outside/center and wall thickness, two-way sidebar sync, real preview dimensions, empty-input recovery, negative circular extrusion, line labels, solid-mode hiding, save/reload/edit and new sketch extrusion'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
