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


 const source=Array.from({length:5},(_,i)=>({...defaults,id:'part'+i,kind:'extrusion',name:'部品'+i,width:60,height:45,depth:8+i,profile:i===4?'circle':'rect',diameter:50,x:500+i*80,y:-400,z:i%2?-20:30}));source.push({...defaults,id:'hidden',kind:'extrusion',name:'非表示',width:500,height:500,depth:20,x:1000});
 async function load(features){await page.locator('#file').setInputFiles({name:'plate.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('print-layout-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#print-layout-error').textContent());}}
 function bounds(outputs){return outputs.map(o=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<o.vertices.length;i++){min[i%3]=Math.min(min[i%3],o.vertices[i]);max[i%3]=Math.max(max[i%3],o.vertices[i]);}return {min,max};});}
 await load(source);await page.locator('#bodies [data-body-id=hidden] .eye').click();const before=await save();await page.locator('#print-layout-tool').click();await ready();assert.equal(await page.locator('#print-layout-margin').inputValue(),'2');assert.equal(await page.locator('#print-layout-gap').inputValue(),'3');assert.match(await page.locator('#print-layout-info').textContent(),/5個を配置/);assert.equal(await page.locator('#print-plate-toggle').getAttribute('aria-pressed'),'true');let preview=await page.locator('#canvas-host').evaluate(el=>JSON.parse(el.dataset.printLayout));assert.equal(preview.placements.length,5);assert.ok(preview.placements.every(p=>p.min[2]===0));await page.screenshot({path:'.sites-runtime/print-layout-preview.png'});
 await page.locator('#print-layout-gap').fill('5');await ready();await page.locator('#print-layout-rotation').uncheck();await ready();preview=await page.locator('#canvas-host').evaluate(el=>JSON.parse(el.dataset.printLayout));assert.ok(preview.placements.every(p=>p.rotation===0));assert.equal(preview.gap,5);await page.locator('#print-layout-cancel').click();assert.deepEqual((await save()).features,before.features);assert.equal(await page.locator('#print-plate-toggle').getAttribute('aria-pressed'),'false');
 await page.locator('#print-layout-tool').click();await ready();await page.locator('#print-layout-apply').click();await page.waitForFunction(()=>!document.getElementById('print-layout-dialog').open);const saved=await save(),feature=saved.features.at(-1);assert.equal(feature.spec.type,'printLayout');assert.equal(feature.outputs.length,5);assert.equal(saved.features.length,7);assert.equal(await page.locator('#body-count').textContent(),'6');assert.equal(await page.locator('#print-plate-toggle').getAttribute('aria-pressed'),'true');for(const b of bounds(feature.outputs)){assert.ok(Math.abs(b.min[2])<1e-4);assert.ok(b.min[0]>=-88-1e-4&&b.min[1]>=-88-1e-4&&b.max[0]<=88+1e-4&&b.max[1]<=88+1e-4);}
 // STL must contain the final positions, with no preview plate geometry.
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});const download=page.waitForEvent('download');await page.locator('#export').click();const stl=await fs.readFile(await(await download).path()),count=stl.readUInt32LE(80);assert.equal(stl.length,84+count*50);for(let i=0;i<count;i++)for(let j=0;j<3;j++){const off=84+i*50+12+j*12,x=stl.readFloatLE(off),y=stl.readFloatLE(off+4),z=stl.readFloatLE(off+8);assert.ok(x>=-88-1e-4&&x<=88+1e-4&&y>=-88-1e-4&&y<=88+1e-4&&z>=-1e-4&&z<=13,'STL vertices stay on the plate');}
 await page.locator('#undo').click();assert.deepEqual((await save()).features,before.features);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.type,'printLayout');await load(saved.features);await page.locator('#features .row-label').last().click();await ready();assert.equal(await page.locator('#print-layout-gap').inputValue(),'3');await page.locator('#print-layout-gap').fill('6');await ready();await page.locator('#print-layout-apply').click();await page.waitForFunction(()=>!document.getElementById('print-layout-dialog').open);assert.equal((await save()).features.at(-1).analysis.gap,6);
 await load([{...source[0],width:181}]);await page.locator('#print-layout-tool').click();await page.waitForFunction(()=>document.getElementById('print-layout-error').textContent.includes('超えています'));assert.ok(await page.locator('#print-layout-apply').isDisabled());await page.locator('#print-layout-cancel').click();assert.equal((await save()).features.length,1);
 await load([{...source[0],width:180,height:180}]);await page.locator('#print-layout-tool').click();await page.waitForFunction(()=>document.getElementById('print-layout-error').textContent.includes('超えています'));await page.locator('#print-layout-margin').fill('0');await page.locator('#print-layout-gap').fill('0');await ready();await page.locator('#print-layout-apply').click();await page.waitForFunction(()=>!document.getElementById('print-layout-dialog').open);assert.equal((await save()).features.at(-1).analysis.placements.length,1);assert.deepEqual(errors,[]);console.log('PASS plate preview/options, visible-only targets, cancel, rigid layout, saved model/reedit, undo/redo, STL positions, overflow rejection and exact single-body edge fit');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
