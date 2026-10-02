import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {featureSolid,runOperation} from '../src/kernel.js';
import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
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
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 const panel=page.locator('#section-panel'),split=page.locator('#section-split'),offset=page.locator('#section-offset'),plane=page.locator('#section-plane'),keep=page.locator('#section-keep');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:40,z:-10};
 async function load(features){await page.locator('#file').setInputFiles({name:'section.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').click();}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function apply(){await split.click();await panel.waitFor({state:'hidden',timeout:40000});return save();}
 async function edit(index=1){await page.locator('#features .row-label').nth(index).click();await panel.waitFor();assert.equal(await split.textContent(),'変更を適用');assert.equal(await page.locator('#section-target').isDisabled(),true);}
 async function colors(){return page.locator('#bodies [data-body-color]').evaluateAll(items=>Object.fromEntries(items.map(e=>[e.dataset.bodyId,e.dataset.bodyColor])));}
 function solidVolume(o){const shape=R.deserializeShape(o.brep).asShape3D(),valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());return R.measureVolume(shape);}finally{valid.delete();shape.delete();}}
 function range(o,axis){const v=o.vertices.filter((_,i)=>i%3===axis);return [Math.min(...v),Math.max(...v)];}

 const center=page.locator('#section-center'),preview=page.locator('#section-preview'),reverse=page.locator('#section-reverse'),target=page.locator('#section-target'),toggleColors=page.locator('#reset-section-colors');
 const shifted={...box,x:10,y:20},other={...box,id:'other',name:'別のボディ',x:200,y:100,z:90};
 await load([shifted,other]);const initial=(await save()).features;await page.locator('#section-toggle').click();await target.selectOption('box');assert.equal(await preview.isChecked(),true);assert.equal(await reverse.isDisabled(),true);
 for(const [name,value] of [['XY',10],['XZ',20],['YZ',10]]){await plane.selectOption(name);await offset.fill('999');assert.equal(await split.isDisabled(),true);await center.click();assert.equal(Number(await offset.inputValue()),value,'center follows selected body on '+name);assert.equal(await split.isEnabled(),true);}
 await target.selectOption('other');await center.click();assert.equal(Number(await offset.inputValue()),200);await plane.selectOption('XY');await center.click();assert.equal(Number(await offset.inputValue()),110);await target.selectOption('box');await center.click();assert.equal(Number(await offset.inputValue()),10);
 assert.deepEqual((await save()).features,initial,'preview and center do not change the saved geometry');
 for(const [side,negative,positive] of [['both','残す','残す'],['positive','取り除く','残す'],['negative','残す','取り除く']]){await keep.selectOption(side);assert.ok((await panel.locator('.section-negative').textContent()).includes(negative));assert.ok((await panel.locator('.section-positive').textContent()).includes(positive));assert.equal(await panel.locator('.section-discard').count(),side==='both'?0:1);assert.equal(await page.locator('#canvas-host').getAttribute('data-section-preview'),'true');await page.screenshot({path:'.sites-runtime/section-preview-'+side+'.png'});}
 await preview.uncheck();assert.equal(await reverse.isEnabled(),true);assert.equal(await page.locator('#canvas-host').getAttribute('data-section-preview'),'false');await reverse.check();await reverse.uncheck();await preview.check();await keep.selectOption('both');await center.click();let data=await apply();assert.equal(data.features.at(-1).spec.offset,10);assert.deepEqual(await colors(),{box:'#6cafd2',[data.features.at(-1).id]:'#e4aa55'});
 const colored=structuredClone(data.features);await toggleColors.click();assert.equal(await toggleColors.getAttribute('aria-pressed'),'false');assert.equal(await toggleColors.textContent(),'色分け OFF');assert.deepEqual(await colors(),{});let off=await save();assert.equal(off.features.at(-1).spec.colorize,false);await load(off.features);assert.equal(await toggleColors.getAttribute('aria-pressed'),'false');await toggleColors.click();assert.equal(await toggleColors.getAttribute('aria-pressed'),'true');assert.deepEqual(await colors(),{box:'#6cafd2',[colored.at(-1).id]:'#e4aa55'});data=await save();const normalized=structuredClone(data.features);delete normalized.at(-1).spec.colorize;assert.deepEqual(normalized,colored,'toggling only changes appearance');await page.locator('#undo').click();assert.deepEqual(await colors(),{});await page.locator('#redo').click();assert.equal(await toggleColors.getAttribute('aria-pressed'),'true');await load(data.features);assert.equal(await toggleColors.getAttribute('aria-pressed'),'true','ON persists after reload');
 await edit(2);await offset.fill('5');await center.click();assert.equal(Number(await offset.inputValue()),10,'re-edit centers on original unsplit body');await keep.selectOption('positive');assert.equal(await panel.locator('.section-negative.section-discard').count(),1);await page.screenshot({path:'.sites-runtime/section-preview-edit.png'});await page.locator('#section-close').click();assert.equal(await page.locator('#canvas-host').getAttribute('data-section-preview'),'false');assert.deepEqual((await save()).features,data.features,'cancel restores model and leaves appearance unchanged');
 await page.setViewportSize({width:1000,height:760});await page.locator('#section-toggle').click();await target.selectOption('box');await center.click();await panel.locator('#section-close').scrollIntoViewIfNeeded();const pr=await panel.boundingBox(),vr=await page.locator('.viewport').boundingBox();assert.ok(pr.y+pr.height<=vr.y+vr.height+1,'new controls fit short viewports');await page.locator('#section-close').click();await page.setViewportSize({width:1600,height:1000});
 await load([]);assert.equal(await toggleColors.isVisible(),false);await page.locator('#section-toggle').click();assert.equal(await center.isDisabled(),true);assert.equal(await split.isDisabled(),true);await page.locator('#section-close').click();assert.deepEqual(errors,[]);await context.close();console.log('PASS preview keep/discard and restoration, selected-body center on XY/XZ/YZ and re-edit, color ON/OFF persistence/undo, unchanged geometry, short viewport and empty model'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
