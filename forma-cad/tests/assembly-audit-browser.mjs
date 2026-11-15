import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {chromium} from 'playwright';
import {cadMesh} from '../src/cad-mesh.js';

R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))}));
const box=(min,max)=>R.makeBox(min,max);
const plate=box([0,0,0],[20,20,10]),peg=box([8,8,9],[12,12,12]);
const shapes=new Map([
 ['base',plate.fuse(peg)],['lid',box([0,0,11],[20,20,15])],
 ['touch',box([20,2,0],[24,6,4])],['gap',box([21,14,0],[25,18,4])],
]);
const features=[];
try{
 for(const [id,shape] of shapes)features.push({kind:'cadop',id,name:id,outputs:[{id,...cadMesh(shape),brep:shape.serialize()}],remove:[]});
}finally{plate.delete();peg.delete();for(const shape of shapes.values())shape.delete();}

const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep))throw Error();
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'});
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1780,height:1200},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>{
  window.showSaveFilePicker=undefined;
  const original=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...args){
   if(message.spec?.type==='assemblyAudit'&&window.holdAssemblyAudit){window.heldAssemblyAudit=true;return;}
   return original.call(this,message,...args);
  };
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#file').setInputFiles({name:'assembly.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
 await page.locator('#project-preview-open').click();
 const host=page.locator('#canvas-host'),tool=page.locator('#assembly-audit-tool'),panel=page.locator('#assembly-audit');
 const controls=name=>panel.locator('[data-'+name+']');
 const read=async key=>JSON.parse(await host.getAttribute('data-'+key));
 const save=async()=>{
  const download=page.waitForEvent('download');await page.locator('#save').click();
  return JSON.parse(await readFile(await (await download).path(),'utf8')).features;
 };
 const before=await save();
 await tool.click();await controls('check').click();
 await page.waitForFunction(()=>!!document.querySelector('#canvas-host').dataset.assemblyAudit);
 assert.deepEqual(await read('assembly-audit'),{total:6,interference:1,contact:1,gap:1,unknown:0,complete:true,incomplete:0});
 const interference=panel.locator('[data-kind=interference]');
 assert.match(await interference.textContent(),/16 mm³/);await interference.click();
 const gap=panel.locator('button[data-face-gap]').filter({hasText:'1 mm'});
 await gap.click();assert.equal((await read('assembly-audit-pair')).status,'face-gap');
 await controls('fit').click();
 await panel.getByRole('button',{name:'ボディの測定結果に戻す'}).click();
 assert.equal((await read('assembly-audit-pair')).exact,true);
 await controls('filter').selectOption('contact');assert.equal(await panel.locator('[data-kind=gap]').count(),0);
 await panel.locator('[data-kind=contact]').click();assert.equal((await read('assembly-audit-pair')).status,'contact');
 await controls('close').click();

 await page.locator('#bodies [data-body-id=base] .row-label').click();
 await tool.click();assert.equal(await controls('scope').inputValue(),'against');
 await controls('gap').fill('.5');await controls('check').click();
 await page.waitForFunction(()=>!!document.querySelector('#canvas-host').dataset.assemblyAudit);
 assert.deepEqual(await read('assembly-audit'),{total:3,interference:1,contact:1,gap:0,unknown:0,complete:true,incomplete:0});
 await page.evaluate(()=>{window.holdAssemblyAudit=true;});await controls('check').click();
 await page.waitForFunction(()=>window.heldAssemblyAudit);await controls('cancel').click();
 assert.match(await controls('status').textContent(),/中止/);
 await controls('close').click();assert.equal(await host.getAttribute('data-assembly-audit-pair'),null);
 assert.deepEqual(await save(),before);assert.deepEqual(errors,[]);
 console.log('PASS batch audit, exact overlap highlight, face gap, focus, filters, scope, cancel, unchanged project');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
