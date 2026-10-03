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
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const host=page.locator('#canvas-host'),base={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:40,depth:40};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'wrap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=front]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function open(){await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([0,-20,20]));assert.match(await page.locator('#measurement-title').textContent(),/円柱/);await page.locator('#wrap-selected-cylinder').click();await page.locator('#svg-wrap-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('svg-wrap-info').textContent.includes('円周'));}
 async function ready(){await page.waitForFunction(()=>!document.getElementById('svg-wrap-apply').disabled&&document.getElementById('canvas-host').dataset.svgWrapPreview==='true',null,{timeout:90000});}


 await page.evaluate(()=>{window.svgTrapInjected=false;const original=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec?.type==='svgWrap'&&!window.svgTrapInjected){window.svgTrapInjected=true;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{id:payload.id,error:'indirect call to null'}})));return;}return original.call(this,payload,...args);};});
 await load([base]);await open();await page.locator('#svg-wrap-file').setInputFiles({name:'recover.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 20H80V80H10Z M30 40H60V60H30Z" fill-rule="evenodd"/></svg>')});await ready();assert.ok(await page.evaluate(()=>window.svgTrapInjected));await page.locator('#svg-wrap-apply').click();await page.waitForFunction(()=>!document.getElementById('svg-wrap-dialog').open);const saved=await save();assert.equal(saved.features.at(-1).spec.repeatCount,5);assert.equal(saved.features.at(-1).spec.fileName,'recover.svg');assert.equal(await page.locator('#body-count').textContent(),'1');assert.deepEqual(errors,[]);await context.close();console.log('PASS SVG native preview/commit/save after one internal engine trap'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
