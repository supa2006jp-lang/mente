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



 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:60,height:40,depth:30},cavity={...defaults,id:'cavity',kind:'extrusion',name:'空洞',profile:'rect',operation:'cut',target:'body',width:55,height:35,depth:25,z:2.5};
 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('ball-joint-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#ball-joint-error').textContent());}}
 async function analysis(){return page.locator('[data-ball-joint]').evaluate(el=>JSON.parse(el.dataset.ballJoint));}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function close(){await page.locator('#ball-joint-cancel').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);}


 const cylinder={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40};
 await load([cylinder]);await page.locator('#ball-joint-tool').click();await ready();
 assert.equal(await page.locator('#ball-joint-neckExtension').inputValue(),'0');
 assert.match(await page.locator('#ball-joint-neck-info').textContent(),/2.50 mm/);
 await page.locator('#ball-joint-neckExtension').fill('15');await ready();
 assert.equal((await analysis()).neckLength,17.5);assert.match(await page.locator('#ball-joint-neck-info').textContent(),/17.50 mm/);
 await page.locator('#ball-joint-neckExtension').fill('-1');assert.ok(await page.locator('#ball-joint-apply').isDisabled());
 await page.locator('#ball-joint-neckExtension').fill('15');await ready();
 await page.locator('#ball-joint-neckExtension').scrollIntoViewIfNeeded();await page.screenshot({path:'.sites-runtime/ball-joint-neck.png'});
 await page.locator('#ball-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('ball-joint-dialog').open);
 const saved=await save();assert.equal(saved.features.at(-1).spec.neckExtension,15);
 await load(saved.features);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();
 assert.equal(await page.locator('#ball-joint-neckExtension').inputValue(),'15');
 await page.locator('#ball-joint-neckExtension').fill('20');await ready();assert.equal((await analysis()).neckLength,22.5);await close();
 assert.equal((await save()).features.at(-1).spec.neckExtension,15);
 const oldSaved=structuredClone(saved.features);delete oldSaved.at(-1).spec.neckExtension;
 await load(oldSaved);await page.locator('#bodies [data-ball-joint-id]').first().click();await ready();
 assert.equal(await page.locator('#ball-joint-neckExtension').inputValue(),'0');assert.equal((await analysis()).neckLength,2.5);await close();
 assert.deepEqual(errors,[]);console.log('PASS visible rod controls/total, extension preview, invalid guard, save/reload, edit cancellation and old-project zero extension');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
