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
 for(const [name,axis,value,min,max] of [['XY',2,5,-10,30],['XZ',1,-7.5,-20,20],['YZ',0,11.25,-30,30]])for(const side of ['both','positive','negative']){
  await load([box]);await page.locator('#section-toggle').click();await plane.selectOption(name);await offset.fill(String(value));await keep.selectOption(side);const data=await apply(),f=data.features.at(-1),expected=side==='both'?96000:96000*(side==='positive'?(max-value):(value-min))/(max-min);assert.equal(f.spec.keep,side);assert.equal(f.outputs.length,side==='both'?2:1);assert.ok(Math.abs(f.outputs.reduce((sum,o)=>sum+solidVolume(o),0)-expected)<.001);assert.equal(f.outputs[0].id,'box','retained body has stable source id');const c=await colors();assert.equal(c.box,side==='positive'?'#e4aa55':'#6cafd2');if(side==='both'){assert.equal(c[f.id],'#e4aa55');assert.notEqual(c.box,c[f.id]);}if(name==='YZ'&&side==='negative'){assert.ok(Math.abs(range(f.outputs[0],axis)[1]-value)<1e-4);await load(data.features);assert.deepEqual(await colors(),c,'colors persist after save/reload');}
 }
 await load([box]);await page.locator('#section-toggle').click();await plane.selectOption('XY');await offset.fill('5');let data=await apply(),initial=data,id=data.features.at(-1).id;await page.screenshot({path:'.sites-runtime/section-split-colors.png'});await edit();assert.equal(await offset.inputValue(),'5');assert.equal(await keep.inputValue(),'both');assert.deepEqual((await save()).features,initial.features,'opening re-edit preserves saved model');await offset.fill('15');assert.equal(await split.isEnabled(),true,'re-edit uses full pre-split solid beyond the old negative-side bounds');await page.screenshot({path:'.sites-runtime/section-split-edit.png'});data=await apply();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).id,id);assert.equal(data.features.at(-1).spec.offset,15);assert.ok(Math.abs(range(data.features.at(-1).outputs[0],2)[1]-15)<1e-4);
 await edit();await offset.fill('20');await page.locator('#section-close').click();assert.deepEqual((await save()).features,data.features,'cancel preserves model');assert.equal(await page.locator('#body-count').textContent(),'2');await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.offset,5);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.offset,15);
 await edit();await plane.selectOption('XZ');await offset.fill('-3');await keep.selectOption('negative');data=await apply();assert.equal(data.features.at(-1).outputs.length,1);assert.equal(data.features.at(-1).spec.plane,'XZ');assert.equal(await page.locator('#body-count').textContent(),'1');await edit();await plane.selectOption('YZ');await offset.fill('3');await keep.selectOption('both');data=await apply();assert.equal(data.features.at(-1).outputs.length,2);assert.equal(data.features.at(-1).id,id);assert.ok(Math.abs(range(data.features.at(-1).outputs[0],0)[1]-3)<1e-4);
 await page.setViewportSize({width:1000,height:760});await edit();const pr=await panel.boundingBox(),vr=await page.locator('.viewport').boundingBox();assert.ok(pr.y+pr.height<=vr.y+vr.height+1,'section panel fits short viewports');await page.locator('#section-close').click();await page.setViewportSize({width:1600,height:1000});
 const legacy=structuredClone(initial.features);delete legacy[1].spec.keep;delete legacy[1].spec.sectionSplit;await load(legacy);await edit();assert.equal(await keep.inputValue(),'both');await offset.fill('8');data=await apply();assert.equal(data.features.at(-1).spec.offset,8,'legacy section split can be re-edited');
 const spec={type:'split',id:'s',target:'box',plane:'XY',offset:5,keep:'both',sectionSplit:true,splitFrame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]}},f={kind:'cadop',id:'s',name:'断面で分離',spec,...runOperation([box],spec)},moveSpec={type:'move',id:'m',target:'s',x:100,y:0,z:0,angle:0,axis:'Z'},move={kind:'cadop',id:'m',name:'移動',spec:moveSpec,...runOperation([box,f],moveSpec)};
 await load([box,f,move]);await edit();await offset.fill('12');data=await apply();assert.equal(data.features.length,3);assert.ok(Math.abs(range(data.features[2].outputs[0],2)[0]-12)<1e-4,'subsequent movement uses re-computed positive body');assert.ok(Math.abs(range(data.features[2].outputs[0],0)[0]-70)<1e-4);assert.equal((await colors()).s,'#e4aa55','colors survive downstream processing');
 await edit();await keep.selectOption('negative');await split.click();await page.waitForFunction(()=>document.getElementById('section-split-error').textContent.includes('変更前'),null,{timeout:40000});assert.equal(await panel.isVisible(),true);assert.deepEqual((await save()).features,data.features,'removing a referenced body rejects safely');await page.locator('#section-close').click();assert.equal(await page.locator('#body-count').textContent(),'2');
 await edit();await offset.fill('100');assert.equal(await split.isDisabled(),true);await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.deepEqual((await save()).features,data.features,'Escape discards edits');assert.deepEqual(errors,[]);await context.close();console.log('PASS retained side modes on XY/XZ/YZ with exact volume, stable ids/colors and reload, split history re-edit using original body, plane/keep changes, cancel/undo/redo/Escape, legacy files, downstream replay and safe reference failure'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
