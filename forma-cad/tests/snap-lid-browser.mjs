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

 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30},upper={...base,id:'lid',name:'上のボディ',z:30,depth:12};
 async function load(features){await page.locator('#file').setInputFiles({name:'lid.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('snap-lid-apply').disabled,null,{timeout:90000});}catch(e){throw Error(await page.locator('#snap-lid-error').textContent());}}
 await load([base,upper]);await page.locator('#snap-lid-tool').click();await ready();assert.equal(await page.locator('#snap-lid-target').inputValue(),'body');assert.equal(await page.locator('#snap-lid-lidTarget').inputValue(),'lid');assert.equal(await page.locator('#snap-lid-pose').inputValue(),'print');assert.match(await page.locator('#snap-lid-info').textContent(),/干渉なし/);await page.screenshot({path:'.sites-runtime/snap-lid-print-preview.png'});
 await page.locator('#snap-lid-pose').selectOption('assembled');await ready();await page.screenshot({path:'.sites-runtime/snap-lid-assembled-preview.png'});await page.locator('#snap-lid-pose').selectOption('print');await ready();await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);const saved=await save();assert.equal(saved.features.at(-1).spec.type,'snapLid');assert.equal(saved.features.at(-1).outputs.length,2);assert.equal(await page.locator('#body-count').textContent(),'2');await page.locator('#undo').click();assert.equal((await save()).features.length,2);await page.locator('#redo').click();assert.equal((await save()).features.length,3);await load(saved.features);assert.match(await page.locator('#bodies').textContent(),/被せ蓋 本体/);assert.match(await page.locator('#bodies').textContent(),/被せ蓋 蓋/);await page.locator('#bodies [data-snap-lid-id]').first().click();await ready();assert.equal(await page.locator('#snap-lid-insertion').inputValue(),'4');await page.locator('#snap-lid-insertion').fill('5');await ready();await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);assert.equal((await save()).features.at(-1).spec.insertion,5);
 await page.locator('#features .row-label').last().click();await ready();await page.locator('#snap-lid-bodyWall').fill('1');await page.waitForFunction(()=>document.getElementById('snap-lid-error').textContent.includes('1.2'));assert.ok(await page.locator('#snap-lid-apply').isDisabled());await page.locator('#snap-lid-cancel').click();assert.equal((await save()).features.at(-1).spec.bodyWall,4.2);await load([...saved.features,{kind:'cadop',id:'removed',name:'蓋を削除',spec:{type:'deleteBodies',targets:['lid']},outputs:[],remove:['lid']}]);await page.locator('#features .row-label').nth(2).click();await ready();await page.locator('#snap-lid-insertion').fill('4.5');await ready();await page.locator('#snap-lid-apply').click();await page.waitForFunction(()=>!document.getElementById('snap-lid-dialog').open);assert.equal((await save()).features[2].spec.insertion,4.5);assert.equal(await page.locator('#body-count').textContent(),'1','subsequent deletion is replayed after editing');await load([base]);await page.locator('#snap-lid-tool').click();assert.ok(!await page.locator('#snap-lid-dialog').isVisible());assert.deepEqual(errors,[]);console.log('PASS lid/body selection, both preview poses, two printable solids, save/reload, edit, undo/redo, invalid/cancel and insufficient bodies');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
