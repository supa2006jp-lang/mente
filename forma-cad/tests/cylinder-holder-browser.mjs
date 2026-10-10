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
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();



 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#cylinder-hinge-error').textContent());}}
 async function analysis(){return page.locator('[data-cylinder-hinge]').evaluate(el=>JSON.parse(el.dataset.cylinderHinge));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#cylinder-hinge-cancel').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);}

const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:60,depth:80};
 await load([cylinder]);await page.locator('#cylinder-hinge-tool').dispatchEvent('click');await ready();
 for(const key of ['openBottom','holderLip','fingerTab'])assert.ok(await page.locator('#cylinder-hinge-'+key).isChecked());
 let a=await analysis();assert.equal(a.openBottom,true);assert.equal(a.holderLip,true);assert.equal(a.fingerTab,true);assert.ok(Math.abs(a.mouthRadius-26.4)<1e-8);assert.ok(await page.locator('#cylinder-hinge-floor').isDisabled());
 await page.locator('#cylinder-hinge-openBottom').uncheck();await ready();assert.equal((await analysis()).openBottom,false);assert.equal(await page.locator('#cylinder-hinge-floor').isDisabled(),false);
 await page.locator('#cylinder-hinge-holderLip').uncheck();await ready();assert.ok(await page.locator('#cylinder-hinge-lipInset').isDisabled());assert.equal((await analysis()).mouthRadius,27.6);
 await page.locator('#cylinder-hinge-fingerTab').uncheck();await ready();assert.ok(await page.locator('#cylinder-hinge-tabReach').isDisabled());assert.equal((await analysis()).fingerTab,false);
 for(const key of ['openBottom','holderLip','fingerTab'])await page.locator('#cylinder-hinge-'+key).check();
 await page.locator('#cylinder-hinge-lipInset').fill('1.5');await page.locator('#cylinder-hinge-lipHeight').fill('3');await page.locator('#cylinder-hinge-tabWidth').fill('22');await page.locator('#cylinder-hinge-tabReach').fill('8');await ready();
 a=await analysis();assert.equal(a.lipInset,1.5);assert.equal(a.tabReach,8);assert.ok(Math.abs(a.mouthRadius-26.1)<1e-8);
 await page.locator('#cylinder-hinge-tabReach').fill('1');assert.ok(await page.locator('#cylinder-hinge-apply').isDisabled());await page.locator('#cylinder-hinge-tabReach').fill('8');await ready();
 await page.locator('#cylinder-hinge-pose').selectOption('open');await ready();await page.locator('#cylinder-hinge-openBottom').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/cylinder-holder-options.png'});
 await page.locator('#cylinder-hinge-pose').selectOption('print');await ready();await page.locator('#cylinder-hinge-apply').click();await page.waitForFunction(()=>!document.getElementById('cylinder-hinge-dialog').open);
 const saved=await save();assert.equal(saved.features.at(-1).spec.tabWidth,22);assert.equal(saved.features.at(-1).spec.openBottom,true);
 await load(saved.features);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();assert.equal(await page.locator('#cylinder-hinge-lipInset').inputValue(),'1.5');assert.ok(await page.locator('#cylinder-hinge-openBottom').isChecked());await close();
 const legacy=structuredClone(saved.features);for(const key of ['openBottom','holderLip','fingerTab','lipInset','lipHeight','tabWidth','tabReach'])delete legacy.at(-1).spec[key];
 await load(legacy);await page.locator('[data-cylinder-hinge-id]').first().click();await ready();for(const key of ['openBottom','holderLip','fingerTab'])assert.equal(await page.locator('#cylinder-hinge-'+key).isChecked(),false);assert.equal((await analysis()).mouthRadius,27.6);await close();
 assert.deepEqual(errors,[]);console.log('PASS holder defaults, independent switches, parameter updates and guard, opening preview, print pose, save/reload/re-edit and legacy opt-in behavior');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
