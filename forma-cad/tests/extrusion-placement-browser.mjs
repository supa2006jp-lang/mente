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

 async function figureClear(depth=2){
  await page.waitForTimeout(120);
  const r=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const boxes=[[[-20,-15,0],[20,15,depth]],[[65,-15,0],[95,15,10]]].map(([lo,hi])=>{const points=[];for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]]){const p=new THREE.Vector3(x,y,z).project(camera);points.push({x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2});}return {left:Math.max(r.x,Math.min(...points.map(p=>p.x))),right:Math.min(r.x+r.width,Math.max(...points.map(p=>p.x))),top:Math.max(r.y,Math.min(...points.map(p=>p.y))),bottom:Math.min(r.y+r.height,Math.max(...points.map(p=>p.y)))};}).filter(b=>b.left<=b.right&&b.top<=b.bottom);
  const viewport=await page.locator('.viewport').boundingBox();
  for(const id of ['extrude-distance','extrude-operation-wheel']){const p=await page.locator('#'+id).boundingBox();assert.ok(p.x>=viewport.x-1&&p.y>=viewport.y-1&&p.x+p.width<=viewport.x+viewport.width+1&&p.y+p.height<=viewport.y+viewport.height+1,id+' remains inside viewport');for(const b of boxes)assert.ok(p.x+p.width<=b.left+1||p.x>=b.right-1||p.y+p.height<=b.top+1||p.y>=b.bottom-1,id+' does not cover sketch, extrusion preview or existing body');}
 }
 await load([body,rect,circle]);await figureClear();assert.notEqual(await page.locator('.viewport').getAttribute('data-extrusion-docked'),'true','ordinary drawing has free space for a floating window');
 for(const view of ['top','front','right','back']){await page.locator('[data-view='+view+']').dispatchEvent('keydown',{key:'Enter'});await figureClear();}
 await page.locator('[data-view=iso]').click();await figureClear();await page.locator('#viewport-depth').fill('15');await figureClear(15);
 await page.setViewportSize({width:1000,height:760});await figureClear(15);await page.screenshot({path:'.sites-runtime/extrusion-placement-compact.png'});await page.setViewportSize({width:1600,height:1000});await figureClear(15);
 await page.locator('#viewport-extrude-cancel').click();await wheel.waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('.viewport').dataset.extrusionDocked);
 await load([rect,circle]);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('canvas').evaluate(e=>{for(let i=0;i<90;i++)e.dispatchEvent(new WheelEvent('wheel',{deltaY:-1000,deltaMode:0,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>document.querySelector('.viewport').dataset.extrusionDocked==='true',null,{timeout:5000});await figureClear();
 const canvas=await page.locator('canvas').boundingBox(),panel=await page.locator('#extrude-distance').boundingBox(),menu=await wheel.boundingBox();assert.ok(panel.x>=canvas.x+canvas.width&&menu.x>=canvas.x+canvas.width,'crowded view reserves space outside the drawing canvas');await page.screenshot({path:'.sites-runtime/extrusion-placement-docked.png'});
 await page.locator('#viewport-extrude-cancel').click();await wheel.waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('canvas-host').clientWidth===document.querySelector('.viewport').clientWidth);
 await load([body,rect,circle]);await figureClear();const handle=await page.locator('#extrude-distance .panel-drag-handle').boundingBox(),v=await page.locator('.viewport').boundingBox();await page.mouse.move(handle.x+20,handle.y+8);await page.mouse.down();await page.mouse.move(v.x+20,v.y+180,{steps:6});await page.mouse.up();await page.locator('#viewport-depth').fill('5');assert.equal(await page.locator('#extrude-distance').getAttribute('data-panel-position'),'manual','intentional manual placement is preserved');await page.locator('#extrude-distance button[type=submit]').click();await wheel.waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('body-count').textContent==='2');await page.waitForFunction(()=>!document.getElementById('extrude-distance').dataset.panelPosition);
 await page.locator('#features .row-label').last().click();await wheel.waitFor();await figureClear(5);assert.notEqual(await page.locator('#extrude-distance').getAttribute('data-panel-position'),'manual','re-editing starts with a fresh automatic placement');await page.screenshot({path:'.sites-runtime/extrusion-placement.png'});await page.locator('#viewport-extrude-cancel').click();assert.deepEqual(errors,[]);await context.close();console.log('PASS extrusion controls avoid figures across views/depth/resize, crowded zoom reserves separate space, cancel restores canvas, manual drag and re-edit remain usable'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
