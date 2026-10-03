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
 const {defaults}=await import('../src/geometry.js'),R=await import('replicad'),init=(await import('../node_modules/replicad-opencascadejs/dist/replicad_single.js')).default;R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const page=await browser.newPage({viewport:{width:1900,height:1150},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});await page.goto('http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 async function load(features){await page.locator('#file').setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);}
 async function save(){const wait=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await wait).path(),'utf8'));}
 async function confirm(type){await page.waitForFunction(t=>document.getElementById('canvas-host').dataset.machiningPreview===t,type,{timeout:45000});const jobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('tools-dialog').open,null,{timeout:90000});assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs,type+' uses cached native result');assert.equal(await page.locator('#canvas-host').getAttribute('data-machining-cache-applied'),'true');return save();}
 await load([{...defaults,id:'path',name:'経路',kind:'sketch',profile:'polyline',mode:'thin',points:[[0,0],[30,0]],closed:false}]);await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('pipe');await page.locator('#cad-diameter').fill('5');await page.locator('#cad-hollow').selectOption('中空');await page.locator('#cad-wall').fill('1');const pipe=await confirm('pipe');assert.equal(pipe.features.at(-1).outputs[0].id,pipe.features.at(-1).id,'preview ID is replaced with persisted body ID');
 await page.locator('#features .row-label').filter({hasText:/パイプ/}).last().click();await page.locator('#cad-diameter').fill('6');const editedPipe=await confirm('pipe');assert.equal(editedPipe.features.length,pipe.features.length);assert.equal(editedPipe.features.at(-1).id,pipe.features.at(-1).id);const shape=R.deserializeShape(editedPipe.features.at(-1).outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(shape)-Math.PI*5*30)<.001);shape.delete();
 await load([{...defaults,id:'box',name:'箱',width:10,height:20,depth:30}]);await page.locator('#direct-enclose').dispatchEvent('click');await page.locator('#cad-thickness').fill('2.5');const enclosed=await confirm('enclose');assert.equal(enclosed.features.at(-1).outputs[0].id,enclosed.features.at(-1).id);assert.equal(await page.locator('#body-count').textContent(),'2');
 await page.locator('#features .row-label').filter({hasText:/囲み形成/}).last().click();await page.locator('#cad-thickness').fill('3');const editedEnclose=await confirm('enclose');assert.equal(editedEnclose.features.length,enclosed.features.length);assert.equal(editedEnclose.features.at(-1).spec.thickness,3);assert.equal(editedEnclose.features.at(-1).outputs[0].id,enclosed.features.at(-1).outputs[0].id);assert.deepEqual(errors,[]);console.log('PASS pipe and enclosure create/edit preview reuse, correct persistent IDs, pipe native volume and unchanged feature count');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
