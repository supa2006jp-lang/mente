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


 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30,z:3},upper={...base,id:'lid',name:'上のボディ',z:33,depth:12};
 async function load(features){await page.locator('#file').setInputFiles({name:'divider.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('snap-lid-apply').disabled,null,{timeout:90000});}catch{throw Error(await page.locator('#snap-lid-error').textContent());}}
 async function apply(){await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);}
 await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();
 assert.ok(!await page.locator('#snap-lid-divider').isChecked());assert.ok(await page.locator('#snap-lid-dividerThickness').isDisabled());assert.ok(await page.locator('#snap-lid-dividerDirection').isDisabled());
 await page.locator('#snap-lid-divider').check();await ready();assert.equal(await page.locator('#snap-lid-dividerThickness').inputValue(),'2.4');assert.equal(await page.locator('#snap-lid-dividerDirection').inputValue(),'short');assert.match(await page.locator('#snap-lid-divider-info').textContent(),/2分割.*2.40 mm.*27.60 mm/);
 await page.locator('#snap-lid-pose').selectOption('assembled');await ready();await page.locator('#snap-lid-filletInside').check();await ready();await page.locator('#snap-lid-filletOutside').check();await ready();await page.locator('#snap-lid-dividerDirection').selectOption('long');await ready();await page.locator('#snap-lid-dividerThickness').fill('3');await ready();
 await page.locator('#snap-lid-dividerThickness').fill('100');await page.waitForFunction(()=>document.getElementById('snap-lid-error').textContent.includes('空間が足りません'));assert.ok(await page.locator('#snap-lid-apply').isDisabled());await page.locator('#snap-lid-dividerThickness').fill('3');await ready();
 await page.locator('#snap-lid-pose').selectOption('print');await ready();await page.locator('#snap-lid-dividerThickness').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/snap-lid-divider-preview.png'});await apply();
 const saved=await save(),f=saved.features.at(-1);assert.equal(f.spec.divider,true);assert.equal(f.spec.dividerDirection,'long');assert.equal(f.spec.dividerThickness,3);assert.equal(f.analysis.divider.thickness,3);assert.equal(f.outputs.length,2);assert.equal(await page.locator('#body-count').textContent(),'2');
 await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.at(-1).spec.divider,true);
 await load(saved.features);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.ok(await page.locator('#snap-lid-divider').isChecked());assert.equal(await page.locator('#snap-lid-dividerThickness').inputValue(),'3');assert.equal(await page.locator('#snap-lid-dividerDirection').inputValue(),'long');
 await page.locator('#snap-lid-divider').uncheck();await ready();assert.ok(await page.locator('#snap-lid-dividerThickness').isDisabled());await apply();const without=await save();assert.equal(without.features.at(-1).analysis.divider,null);assert.equal(without.features.at(-1).spec.divider,false);
 await page.locator('#undo').click();assert.equal((await save()).features.at(-1).spec.divider,true);
 const legacy=structuredClone(without.features);for(const k of ['divider','dividerThickness','dividerDirection'])delete legacy.at(-1).spec[k];await load(legacy);await page.locator('#features .row-label').last().click();await ready();assert.ok(!await page.locator('#snap-lid-divider').isChecked());assert.equal(await page.locator('#snap-lid-dividerThickness').inputValue(),'2.4');await page.locator('#snap-lid-cancel').click();
 assert.deepEqual(errors,[]);console.log('PASS divider option, default/disabled fields, two directions, fillets, invalid dimensions, save/reload, editing, disable, legacy and undo/redo');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
