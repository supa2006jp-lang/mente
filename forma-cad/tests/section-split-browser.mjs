import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {featureSolid} from '../src/kernel.js';
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


 const panel=page.locator('#section-panel'),split=page.locator('#section-split'),offset=page.locator('#section-offset'),plane=page.locator('#section-plane');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:40,z:-10};
 async function load(features){await page.locator('#file').setInputFiles({name:'section.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').click();}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function apply(){await split.click();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sectionActive==='false'||(!document.getElementById('section-split').disabled&&document.getElementById('section-split-error').textContent),null,{timeout:40000});assert.equal(await panel.isVisible(),false,await page.locator('#section-split-error').textContent());return save();}
 function nativeVolume(shape){try{const valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid(),'separated solid is valid');}finally{valid.delete();}const result=R.measureVolume(shape);assert.ok(result>0);return result;}finally{shape.delete();}}
 function check(data,input,axis,position){const f=data.features.at(-1);assert.equal(f.name,'断面で分離');assert.equal(f.spec.type,'split');assert.equal(f.spec.target,input.id);assert.equal(f.spec.offset,position);assert.equal(f.outputs.length,2);assert.deepEqual(f.remove,[]);assert.ok(f.outputs.every(o=>o.brep));const bounds=f.outputs.map(o=>{const values=o.vertices.filter((_,i)=>i%3===axis);return [Math.min(...values),Math.max(...values)];}).sort((a,b)=>a[0]-b[0]);assert.ok(Math.abs(bounds[0][1]-position)<1e-4,JSON.stringify(bounds));assert.ok(Math.abs(bounds[1][0]-position)<1e-4,JSON.stringify(bounds));assert.ok(Math.abs(f.outputs.reduce((sum,o)=>sum+nativeVolume(R.deserializeShape(o.brep).asShape3D()),0)-nativeVolume(featureSolid(input)))<.001,'split preserves total solid volume');}
 for(const [name,axis,value] of [['XY',2,5.125],['XZ',1,-7.5],['YZ',0,11.25]]){
  await load([box]);await page.locator('#section-toggle').click();await plane.selectOption(name);await offset.fill(String(value));if(name==='XZ')await page.locator('#section-reverse').check();assert.equal(await split.isEnabled(),true);assert.equal((await save()).features.length,1,'display alone does not modify the model');let position=value;
  if(name==='XY'){const h=await page.locator('#section-drag').boundingBox(),camera=await page.locator('#canvas-host').getAttribute('data-camera-state');await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+5,h.y+h.height/2-15,{steps:5});await page.mouse.up();position=Number(await offset.inputValue());assert.notEqual(position,value);assert.ok(JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')).every((v,i)=>Math.abs(v-JSON.parse(camera)[i])<1e-8),'section drag does not move camera');await page.screenshot({path:'.sites-runtime/section-split-panel.png'});}
  const data=await apply();check(data,box,axis,position);assert.equal(finiteBodyCount(data),2);assert.equal(await page.locator('#body-count').textContent(),'2');await page.locator('#undo').click();assert.equal(await page.locator('#body-count').textContent(),'1');assert.equal((await save()).features.length,1);await page.locator('#redo').click();assert.equal(await page.locator('#body-count').textContent(),'2');await load(data.features);assert.equal(await page.locator('#body-count').textContent(),'2','saved split reloads as separate solids');
 }
 function finiteBodyCount(data){const bodies=rebuild(data.features);for(const b of bodies.values())b.geometry.dispose();return bodies.size;}
 const ring={...box,id:'ring',name:'中空の円柱',profile:'circle',diameter:30,mode:'thin',wall:3,z:0,depth:20};await load([ring]);await page.locator('#section-toggle').click();await plane.selectOption('XY');await offset.fill('7.5');check(await apply(),ring,2,7.5);
 await load([box]);await page.locator('#section-toggle').click();await plane.selectOption('XY');for(const value of ['100','30','-10','']){await offset.fill(value);assert.equal(await split.isDisabled(),true,'outside/boundary/blank cannot split: '+JSON.stringify(value)+'; '+await page.locator('#section-split-error').textContent());}await offset.fill('5');assert.equal(await split.isEnabled(),true);await page.locator('#section-close').click();assert.equal((await save()).features.length,1,'invalid positions and closing leave the model unchanged');
 const other={...box,id:'other',name:'別のボディ',x:100};await load([box,other]);await page.locator('#bodies [data-body-id="other"] .row-label').click();await page.locator('#section-toggle').click();assert.equal(await page.locator('#section-target').inputValue(),'other','selected body is the default target');await plane.selectOption('XY');await offset.fill('5');let data=await apply();assert.equal(data.features.at(-1).spec.target,'other');assert.equal(data.features.at(-1).outputs.length,2);assert.equal(await page.locator('#body-count').textContent(),'3');assert.equal(data.features[0].id,'box');
 await load([box,other]);await page.locator('#bodies [data-body-id="other"] .eye').click();await page.locator('#section-toggle').click();assert.deepEqual(await page.locator('#section-target option').evaluateAll(items=>items.map(i=>i.value)),['box'],'hidden bodies are excluded');await page.locator('#section-close').click();await load([]);await page.locator('#section-toggle').click();assert.equal(await split.isDisabled(),true);assert.deepEqual(errors,[]);await context.close();console.log('PASS section-position split XY/XZ/YZ including signed/reversed/dragged offsets, native closed outputs and conserved volume, ring, target selection, invalid/no-body positions, save/reload and undo/redo'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
