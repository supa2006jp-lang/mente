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


 const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:60,height:40,depth:30},bottom={...base,depth:15},upper={...base,id:'upper',name:'上のパーツ',z:15,depth:15};
 async function load(features){await page.locator('#file').setInputFiles({name:'joint.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function ready(expected={}){try{await page.waitForFunction(expected=>{const d=document.getElementById('viewport')||document.querySelector('[data-boss-joint]'),value=document.querySelector('[data-boss-joint]')?.dataset.bossJoint;const a=value&&JSON.parse(value);return !document.getElementById('boss-joint-apply').disabled&&a&&Object.entries(expected).every(([k,v])=>a[k]===v);},expected,{timeout:90000});}catch(e){throw Error(await page.locator('#boss-joint-error').textContent());}}
 async function apply(){await page.locator('#boss-joint-apply').click();await page.waitForFunction(()=>!document.getElementById('boss-joint-dialog').open);}
 await load([base]);await page.locator('#boss-joint-tool').click();await ready({count:2,diameter:3});assert.equal(await page.locator('#boss-joint-mode').inputValue(),'split');assert.equal(await page.locator('#boss-joint-offset').inputValue(),'15');assert.equal(await page.locator('#boss-joint-pose').inputValue(),'print');assert.match(await page.locator('#boss-joint-info').textContent(),/干渉なし/);await page.screenshot({path:'.sites-runtime/boss-joint-print-preview.png'});
 await page.locator('#boss-joint-pose').selectOption('assembled');await ready();await page.screenshot({path:'.sites-runtime/boss-joint-assembled-preview.png'});await page.locator('#boss-joint-pose').selectOption('print');await ready();await apply();const saved=await save();assert.equal(saved.features.length,2);assert.equal(saved.features.at(-1).spec.type,'bossJoint');assert.equal(saved.features.at(-1).outputs.length,2);assert.equal(await page.locator('#body-count').textContent(),'2');assert.match(await page.locator('#bodies').textContent(),/ボス接合 ボス側/);assert.match(await page.locator('#bodies').textContent(),/ボス接合 棒側/);
 await page.locator('#undo').click();assert.equal((await save()).features.length,1);assert.equal(await page.locator('#body-count').textContent(),'1');await page.locator('#redo').click();assert.equal((await save()).features.length,2);await load(saved.features);await page.locator('#bodies [data-boss-joint-id]').first().click();await ready();await page.locator('#boss-joint-diameter').fill('4');await ready({diameter:4});await page.locator('#boss-joint-count').selectOption('4');await ready({diameter:4,count:4});await apply();let edited=await save();assert.equal(edited.features.length,2);assert.equal(edited.features.at(-1).spec.diameter,4);assert.equal(edited.features.at(-1).analysis.count,4);
 await page.locator('#features .row-label').last().click();await ready();await page.locator('#boss-joint-clearance').fill('1.5');assert.ok(await page.locator('#boss-joint-apply').isDisabled());await page.locator('#boss-joint-cancel').click();assert.deepEqual((await save()).features,edited.features);assert.equal(await page.locator('#bodies .eye[aria-pressed=true]').count(),2);
 const pinId=saved.features.at(-1).outputs[1].id;await load([...saved.features,{kind:'cadop',id:'removed',name:'棒側を削除',spec:{type:'deleteBodies',targets:[pinId]},outputs:[],remove:[pinId]}]);await page.locator('#features .row-label').nth(1).click();await ready();await page.locator('#boss-joint-diameter').fill('3.5');await ready({diameter:3.5});await apply();assert.equal((await save()).features[1].spec.diameter,3.5);assert.equal(await page.locator('#body-count').textContent(),'1','downstream deletion is replayed');
 const cavity={...defaults,id:'cavity',kind:'extrusion',name:'空洞',profile:'rect',operation:'cut',target:'body',width:55,height:35,depth:25,z:2.5};await load([base,cavity]);await page.locator('#boss-joint-tool').click();await ready();await page.screenshot({path:'.sites-runtime/boss-joint-hollow-preview.png'});assert.match(await page.locator('#boss-joint-info').textContent(),/12.80/);await page.locator('#boss-joint-cancel').click();
 await load([bottom,upper]);await page.locator('#boss-joint-tool').click();await ready();assert.equal(await page.locator('#boss-joint-mode').inputValue(),'pair');assert.equal(await page.locator('#boss-joint-target').inputValue(),'body');assert.equal(await page.locator('#boss-joint-pinTarget').inputValue(),'upper');await page.locator('#boss-joint-swap').click();await ready();assert.equal(await page.locator('#boss-joint-target').inputValue(),'upper');await page.screenshot({path:'.sites-runtime/boss-joint-pair-preview.png'});await apply();assert.deepEqual((await save()).features.at(-1).outputs.map(o=>o.id),['upper','body']);
 await load([base]);await page.setViewportSize({width:1280,height:900});await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('bossJoint');await ready();assert.equal(await page.locator('#tools-dialog').isVisible(),false);await page.locator('#boss-joint-cancel').click();await page.locator('#advanced-tools').click();await ready();assert.equal(await page.locator('#tools-dialog').isVisible(),false);await page.locator('#boss-joint-cancel').click();assert.equal((await save()).features.length,1);assert.deepEqual(errors,[]);console.log('PASS split/pair, swap, previews, save/reload/edit, undo/redo, cancel/invalid, downstream replay, advanced access');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
