import {binaryStlReport} from './stl-topology.mjs';
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
 await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 page.setDefaultTimeout(120000);
 async function load(features){await page.locator('#file').setInputFiles({name:'joint.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
 async function ready(radius,pose){try{await page.waitForFunction(({radius,pose})=>{const el=document.querySelector('[data-ball-joint]'),a=el&&JSON.parse(el.dataset.ballJoint);return a&&a.socketEntryFillet===radius&&(!pose||a.pose===pose)&&!document.getElementById('ball-joint-apply').disabled;},{radius,pose},{timeout:120000});}catch(e){throw Error(await page.locator('#ball-joint-error').textContent());}}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 const source={...defaults,id:'c',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40};
 await load([source]);await page.locator('#ball-joint-tool').click();await ready(.3);
 assert.equal(await page.locator('#ball-joint-socketEntryFillet').inputValue(),'0.3','new joints start with a small fillet');
 await page.locator('#ball-joint-cancel').click();
 const legacy=JSON.parse(await fs.readFile('.sites-runtime/socket-entry-legacy-project.json','utf8'));await load(legacy.features);
 await page.locator('#bodies [data-ball-joint-id]').first().click();await ready(0);assert.equal(await page.locator('#ball-joint-socketEntryFillet').inputValue(),'0','existing joints keep the original entrance until edited');
 await page.locator('#ball-joint-socketEntryFillet').fill('.3');await page.locator('#ball-joint-pose').selectOption('print');await ready(.3,'print');
 await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);
 const saved=await save(),joint=saved.features.at(-1);assert.equal(joint.spec.socketEntryFillet,.3);assert.equal(joint.analysis.socketEntryFillet,.3);assert.equal(joint.spec.ballDiameter,legacy.features.at(-1).spec.ballDiameter);assert.equal(joint.spec.threadPitch,legacy.features.at(-1).spec.threadPitch);
 await page.locator('#bodies [data-body-id="joint-socket"] .body-isolate').click();
 const exported=page.waitForEvent('download');await page.locator('#export').click();const bytes=await fs.readFile(await(await exported).path()),report=binaryStlReport(bytes);
 for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,'isolated rounded socket '+k);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready(.3,'print');assert.equal(await page.locator('#ball-joint-socketEntryFillet').inputValue(),'0.3');
 await page.locator('#ball-joint-cancel').click();assert.deepEqual(errors,[]);
 console.log('PASS new R0.3, legacy R0 upgrade, preserved ball/thread dimensions, save/reopen and isolated rounded socket STL',report);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
