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

 const reset=page.locator('#reset-section-colors');
 await load([box]);assert.equal(await reset.isVisible(),false,'no color reset without a split');
 const spec={type:'split',id:'s',target:'box',plane:'XY',offset:5,keep:'both',sectionSplit:true,splitFrame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]}},f={kind:'cadop',id:'s',name:'断面で分離',spec,...runOperation([box],spec)},moveSpec={type:'move',id:'m',target:'s',x:100,y:0,z:0,angle:0,axis:'Z'},move={kind:'cadop',id:'m',name:'移動',spec:moveSpec,...runOperation([box,f],moveSpec)};
 await load([box,f,move]);assert.deepEqual(await colors(),{box:'#6cafd2',s:'#e4aa55'});assert.equal(await reset.isVisible(),true);
 await page.locator('#bodies [data-body-id="s"] .eye').click();await reset.click();assert.deepEqual(await colors(),{});assert.equal(await reset.isVisible(),true);assert.equal(await reset.getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#body-count').textContent(),'2');assert.equal(await page.locator('#bodies [data-body-id="s"] .eye').getAttribute('aria-pressed'),'false','hidden body remains hidden');
 let data=await save();assert.equal(data.features[1].spec.colorize,false);const normalized=structuredClone(data.features);delete normalized[1].spec.colorize;assert.deepEqual(normalized,JSON.parse(JSON.stringify([box,f,move])),'only appearance metadata changes; no mesh or BRep mutation');
 await page.locator('#undo').click();assert.deepEqual(await colors(),{box:'#6cafd2',s:'#e4aa55'});await page.locator('#redo').click();assert.deepEqual(await colors(),{});
 await load(data.features);assert.deepEqual(await colors(),{},'reset survives save/reload including moved body');assert.equal(await reset.isVisible(),true);assert.equal(await reset.getAttribute('aria-pressed'),'false');assert.ok((await page.locator('#bodies [data-body-id="box"] .row-label').textContent()).includes('−Z側'),'side label is retained');
 await edit();await offset.fill('12');data=await apply();assert.equal(data.features[1].spec.colorize,false,'re-edit keeps normal color');assert.deepEqual(await colors(),{});assert.ok(Math.abs(range(data.features[2].outputs[0],2)[0]-12)<1e-4,'downstream geometry is recalculated');
 await page.screenshot({path:'.sites-runtime/section-colors-reset.png'});
 await page.locator('#section-toggle').click();await plane.selectOption('XY');await page.locator('#section-target').selectOption('box');await offset.fill('0');data=await apply();const newId=data.features.at(-1).id;assert.equal((await colors()).box,'#6cafd2');assert.equal((await colors())[newId],'#e4aa55');assert.equal((await colors()).s,undefined,'new split colors do not recolor previous reset body');
 await page.screenshot({path:'.sites-runtime/section-colors-reset-button.png'});await reset.click();data=await save();assert.deepEqual(await colors(),{});assert.equal(data.features.filter(f=>f.kind==='cadop'&&f.spec.type==='split'&&f.spec.colorize===false).length,2,'all split colors can be reset together');
 await load(data.features);assert.deepEqual(await colors(),{});assert.deepEqual(errors,[]);await context.close();console.log('PASS color reset button, hidden bodies, unchanged geometry, undo/redo, persistence, re-edit/downstream replay, and new split colors'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
