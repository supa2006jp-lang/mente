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
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const rect={...defaults,id:'s',name:'四角',kind:'sketch',profile:'rect',width:40,height:30,groupId:'g',groupNumber:1},circle={...rect,id:'h',name:'穴',profile:'circle',diameter:10},body={...defaults,id:'b',name:'対象ボディ',kind:'extrusion',width:30,height:30,depth:10,x:80};
 const wheel=page.locator('#extrude-operation-wheel'),button=value=>page.locator('[data-extrude-operation='+value+']');
 async function load(features){await page.locator('#file').setInputFiles({name:'wheel.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const q=new THREE.Vector3(8,0,0).project(c);await page.mouse.click(r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2);await page.locator('#solid-tool').click();await wheel.waitFor();}
 async function placement(){const w=await wheel.boundingBox(),p=await page.locator('#extrude-distance').boundingBox(),v=await page.locator('#canvas-host').boundingBox();assert.ok(w.y+w.height<=p.y-5,'wheel is above small window');assert.ok(Math.abs(w.x+w.width/2-p.x-p.width/2)<2,'wheel is centered above window');assert.ok(w.x>=v.x&&w.y>=v.y&&w.x+w.width<=v.x+v.width&&p.y+p.height<=v.y+v.height+2,'wheel and window stay within viewport');}
 await load([rect]);assert.equal(await button('newHoles').isDisabled(),true);assert.equal(await button('join').isDisabled(),true);assert.equal(await button('cut').isDisabled(),true);assert.match(await button('newHoles').getAttribute('title'),/穴がありません/);await placement();await page.locator('#viewport-extrude-cancel').click();await wheel.waitFor({state:'hidden'});
 await load([body,rect,circle]);
 for(const value of ['newHoles','join','cut','new']){await button(value).click();assert.equal(await page.locator('#operation').inputValue(),value);assert.equal(await page.locator('#viewport-operation').inputValue(),value);assert.equal(await button(value).getAttribute('aria-pressed'),'true');assert.equal(await wheel.locator('[aria-pressed=true]').count(),1);await placement();}
 await page.locator('#viewport-operation').selectOption('cut');await page.waitForFunction(()=>document.querySelector('[data-extrude-operation=cut]').getAttribute('aria-pressed')==='true');
 await button('join').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#operation').inputValue(),'join');assert.equal(await page.locator('#body-count').textContent(),'1','keyboard switching does not submit extrusion');
 await button('new').click();await page.mouse.move(20,20);await page.waitForTimeout(180);assert.deepEqual(await button('new').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})),{background:'rgb(8, 127, 165)',color:'rgb(255, 255, 255)'});await page.screenshot({path:'.sites-runtime/extrusion-wheel.png'});
 const handle=await page.locator('#extrude-distance .panel-drag-handle').boundingBox(),viewport=await page.locator('#canvas-host').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(viewport.x+15,viewport.y+15,{steps:8});await page.mouse.up();await page.waitForTimeout(100);await placement();
 await page.setViewportSize({width:1000,height:760});await page.waitForTimeout(150);await placement();await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(150);
 await page.locator('#viewport-depth').fill('5');await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2',null,{timeout:10000});await wheel.waitFor({state:'hidden'});assert.equal(await page.locator('#extrude-distance').isVisible(),false);
 const event=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await event).path(),'utf8'));assert.equal(saved.features.at(-1).operation,'new');assert.equal(saved.features.at(-1).holesOnly,false);assert.equal(saved.features.at(-1).depth,5);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS radial extrusion operations, disabled unavailable options, dropdown/keyboard sync, viewport placement and new body confirmation'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
