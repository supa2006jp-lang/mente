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
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[],failures=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));page.on('response',r=>responses.push({url:new URL(r.url()).pathname,status:r.status()}));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto('http://127.0.0.1:'+server.address().port+prefix);
 await page.waitForURL('**/mente/forma-cad/dist/');await page.locator('canvas').waitFor();
 await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('sphere');await page.locator('#cad-radius').fill('7');await page.locator('#cad-apply').click();
 await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1',null,{timeout:120000});
 const dl=page.waitForEvent('download');await page.locator('#save').click();const download=await dl;
 const saved=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 assert.equal(saved.features[0].spec.type,'sphere');assert.equal(saved.features[0].spec.radius,7);assert.ok(saved.features[0].outputs[0].vertices.length>0);
 await page.locator('#file').setInputFiles({name:'saved.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open&&document.getElementById('body-count').textContent==='1');
 for(const name of ['app.js','style.css','kernel-worker.js','replicad_single.wasm'])assert.ok(responses.some(r=>r.url===prefix+'dist/'+name&&r.status===200),name+' must load from repository subfolder');
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await context.close();console.log('PASS anonymous GitHub Pages subfolder, worker/WASM CAD calculation, file save and reload');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
