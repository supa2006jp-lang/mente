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

 const rect={...defaults,id:'s',name:'四角',kind:'sketch',width:40,height:30,groupId:'g',groupNumber:1};
 async function load(features){await page.locator('#file').setInputFiles({name:'taper.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function preview(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1'&&!document.getElementById('viewport-depth-error').textContent,null,{timeout:30000});}
 async function confirm(){await page.locator('#extrude-distance button[type=submit]').click();await page.locator('#extrude-distance').waitFor({state:'hidden',timeout:30000});}
 await load([rect]);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(150);
 const r=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(state);c.quaternion.fromArray(state,3);c.zoom=state[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const q=new THREE.Vector3(8,0,0).project(c);await page.mouse.click(r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2);await page.locator('#solid-tool').click();await page.locator('#extrude-distance').waitFor();
 assert.equal(await page.locator('#viewport-taper-angle').inputValue(),'0');await page.locator('[data-view=iso]').click();await page.locator('#viewport-depth').fill('10');await page.locator('#viewport-taper-angle').fill('10');assert.equal(await page.locator('#taperAngle').inputValue(),'10');await preview();await page.screenshot({path:'.sites-runtime/extrusion-taper.png'});await confirm();
 let data=await save(),f=data.features.at(-1);assert.equal(f.taperAngle,10);assert.ok(f.cadResult.outputs[0].brep);const vertices=f.cadResult.outputs[0].vertices,top=[];for(let i=0;i<vertices.length;i+=3)if(Math.abs(vertices[i+2]-10)<1e-5)top.push(vertices[i]);assert.ok(Math.abs(Math.max(...top)-Math.min(...top)-(40+20*Math.tan(Math.PI/18)))<.001);
 await load(data.features);await page.locator('#features .row-label').last().click();await page.locator('#extrude-distance').waitFor();assert.equal(await page.locator('#viewport-taper-angle').inputValue(),'10');await page.locator('#taperAngle').fill('-5');await page.waitForFunction(()=>document.getElementById('viewport-taper-angle').value==='-5');await preview();await confirm();data=await save();assert.equal(data.features.at(-1).taperAngle,-5);
 await page.locator('#features .row-label').last().click();await page.locator('#viewport-taper-reset').click();assert.equal(await page.locator('#taperAngle').inputValue(),'0');await confirm();data=await save();assert.equal(data.features.at(-1).taperAngle,0);
 await page.locator('#features .row-label').last().click();await page.locator('#viewport-taper-angle').fill('81');await page.waitForFunction(()=>document.getElementById('viewport-depth-error').textContent.includes('80'));await page.locator('#viewport-taper-angle').fill('-70');await page.locator('#viewport-depth').fill('100');await page.waitForFunction(()=>document.getElementById('viewport-depth-error').textContent.includes('この角度'),null,{timeout:30000});await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('viewport-depth-error').textContent.includes('この角度'),null,{timeout:30000});assert.equal((await save()).features.at(-1).taperAngle,0,'invalid taper leaves the original body unchanged');await page.locator('#viewport-extrude-cancel').click();
 const legacy={...defaults,id:'old',name:'以前の押し出し',kind:'extrusion',width:40,height:30,depth:10};delete legacy.taperAngle;await load([legacy]);await page.locator('#features .row-label').last().click();assert.equal(await page.locator('#taperAngle').inputValue(),'0');await page.locator('#viewport-extrude-cancel').click();
 assert.deepEqual(errors,[]);await context.close();console.log('PASS taper default, new sketch extrusion, exact preview/confirmed dimensions, main/popup sync, save/reload/re-edit, reset to 0°, invalid/collapsed angle preserves body, legacy file'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
