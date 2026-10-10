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
 const context=await browser.newContext({viewport:{width:1900,height:1150},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader error/i.test(m.text()))errors.push(m.text());});page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#cylinder-hinge-error').textContent());}}
 async function analysis(){return page.locator('[data-cylinder-hinge]').evaluate(el=>JSON.parse(el.dataset.cylinderHinge));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#cylinder-hinge-cancel').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);}

const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:60,depth:80};
 await load([cylinder]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();
 assert.equal((await analysis()).fitHolder,false);assert.equal(await page.locator('#cylinder-hinge-fitHolder').isChecked(),false);assert.ok(await page.locator('#cylinder-hinge-holderDiameter').isDisabled());
 assert.equal(await page.locator('#cylinder-hinge-plate-info').getAttribute('data-fits'),'true');assert.ok((await page.locator('#cylinder-hinge-plate-info').textContent()).includes('180 × 180'));
 await page.locator('#cylinder-hinge-fitHolder').check();await page.locator('#cylinder-hinge-holderDiameter').fill('56');await page.locator('#cylinder-hinge-holderGap').fill('0.3');await ready();
 let a=await analysis();assert.equal(a.innerRadius,28.3);assert.ok(Math.abs(a.wall-1.7)<1e-7);assert.ok(await page.locator('#cylinder-hinge-wall').isDisabled());assert.equal(await page.locator('#cylinder-hinge-section svg').count(),1);assert.ok((await page.locator('#cylinder-hinge-section').textContent()).includes('56.60 mm'));
 await page.locator('#cylinder-hinge-holderDiameter').fill('59');await page.waitForFunction(()=>document.getElementById('cylinder-hinge-error').textContent.includes('壁厚'));assert.ok(await page.locator('#cylinder-hinge-apply').isDisabled());assert.equal(await page.locator('#cylinder-hinge-section svg').count(),0);
 await page.locator('#cylinder-hinge-holderDiameter').fill('56');await ready();await page.locator('#cylinder-hinge-fitHolder').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-holder-fit.png'});
 await page.locator('#cylinder-hinge-apply').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);
 const saved=await save();assert.equal(saved.features.at(-1).spec.fitHolder,true);assert.equal(saved.features.at(-1).spec.holderDiameter,56);
 await load(saved.features);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();assert.ok(await page.locator('#cylinder-hinge-fitHolder').isChecked());assert.equal(await page.locator('#cylinder-hinge-holderDiameter').inputValue(),'56');
 await page.locator('#cylinder-hinge-fitHolder').uncheck();await ready();assert.equal((await analysis()).fitHolder,false);assert.equal(await page.locator('#cylinder-hinge-section svg').count(),0);await close();
 const oversized={...cylinder,diameter:90,depth:100};await load([oversized]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();assert.equal((await analysis()).printBounds.fits,false);assert.equal(await page.locator('#cylinder-hinge-plate-info').getAttribute('data-fits'),'false');assert.ok((await page.locator('#cylinder-hinge-plate-info').textContent()).includes('赤色'));await page.locator('#cylinder-hinge-plate-info').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-holder-overflow.png'});
 await page.locator('#cylinder-hinge-pose').selectOption('closed');await ready();assert.equal((await analysis()).printBounds,null);assert.equal(await page.locator('#cylinder-hinge-plate-info').getAttribute('data-fits'),'');await close();
 assert.deepEqual(errors,[]);console.log('PASS plate fit/overflow and shader rendering, opt-in dimensions, section preview, wall guard, persisted re-edit and cleanup');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
