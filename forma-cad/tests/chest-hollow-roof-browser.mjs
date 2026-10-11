import {binaryStlReport} from './stl-topology.mjs';
import {defaults} from '../src/geometry.js';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
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




 await page.setDefaultTimeout(120000);
 R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 async function load(features){await page.locator('#file').setInputFiles({name:'chest.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
 async function apply(){await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:120000});}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function edit(){await page.locator('#features .tree-row').last().locator('button.row-label').click();await page.locator('#cad-chestStyle').waitFor();}
 function inspect(operation){
  const lid=R.deserializeShape(operation.outputs[1].brep).asShape3D(),probe=R.makeBox([-.1,-.1,23.9],[.1,.1,24.1]),common=lid.intersect(probe);
  try{assert.ok(Math.abs(R.measureVolume(common))<1e-8,'generated vault above the old flat ceiling is empty');}
  finally{common.delete();probe.delete();lid.delete();}
 }
 await load([{...defaults,id:'source',name:'対象',width:30,height:20,depth:20,x:0,y:0}]);
 await page.locator('#direct-enclose').dispatchEvent('click');await page.locator('#cad-boxMode').check();await page.locator('#cad-chestStyle').check();
 assert.equal(await page.locator('#cad-thickness').inputValue(),'3');assert.equal(await page.locator('#cad-hinge').isChecked(),true);assert.equal(await page.locator('#cad-snapLatch').isChecked(),true);
 await page.locator('#cad-hingeEdge').selectOption('+Y');await apply();
 const project=await save();inspect(project.features.at(-1));
 await load(project.features);await edit();assert.equal(await page.locator('#cad-chestStyle').isChecked(),true);await apply();
 const regenerated=await save();inspect(regenerated.features.at(-1));
 const exported=page.waitForEvent('download');await page.locator('#export-enclosure').click();const bytes=await fs.readFile(await(await exported).path()),report=binaryStlReport(bytes);
 for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,'hollow chest STL '+k);
 let minZ=Infinity;for(let i=0;i<report.triangles;i++)for(let j=0;j<3;j++)minZ=Math.min(minZ,bytes.readFloatLE(84+i*50+12+j*12+8));assert.ok(Math.abs(minZ)<1e-4);
 await edit();await page.locator('#enclose-print-pose').click();await apply();await page.locator('[data-view=iso]').dispatchEvent('click');await page.locator('#fit').click();
 await page.locator('#bodies [data-body-id="source"]').first().evaluate(el=>el.closest('.tree-row').querySelector('.eye')?.click());
 await fs.mkdir('.sites-runtime',{recursive:true});await page.screenshot({path:'.sites-runtime/chest-hollow-roof.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS hollow chest preview/create, saved BREP cavity, re-open/edit regeneration, reinforced hinge/latch and downloaded closed STL',report);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
