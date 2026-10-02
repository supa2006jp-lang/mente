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
 const rect={...defaults,kind:'sketch',id:'rect',name:'四角形',profile:'rect',width:40,height:30,groupId:'g',groupNumber:1},circle={...rect,id:'circle',name:'円',profile:'circle',diameter:20};
 async function load(features){await page.locator('#file').setInputFiles({name:'holes.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);const r=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),camera=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const q=new THREE.Vector3(8,0,0).project(camera);await page.mouse.click(r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2);await page.locator('#solid-tool').click();await page.locator('#extrude-distance').waitFor();}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 for(const sketch of [rect,circle]){
  await load([sketch]);
  for(const input of ['viewport-operation','operation']){
   await page.locator('#'+input).selectOption('newHoles');await page.waitForTimeout(100);
   assert.equal(await page.locator('#operation').inputValue(),'new');assert.equal(await page.locator('#viewport-operation').inputValue(),'new');assert.match(await page.locator('#viewport-depth-error').textContent(),/穴がありません/);assert.match(await page.locator('#error').textContent(),/新規ボディ/);assert.equal(await page.locator('#extrude-distance button[type=submit]').isEnabled(),true);
  }
  const before=await page.locator('#canvas-host').getAttribute('data-camera-state'),r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,-200);await page.waitForFunction(old=>document.getElementById('canvas-host').dataset.cameraState!==old,before,{timeout:3000});
  await page.locator('#viewport-depth').fill('5');await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1',null,{timeout:5000});assert.equal(await page.locator('#extrude-distance').isVisible(),false);
  const data=await save();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).operation,'new');assert.equal(data.features.at(-1).holesOnly,false);
 }
 await load([rect,{...circle,diameter:10}]);await page.locator('#viewport-operation').selectOption('newHoles');assert.equal(await page.locator('#operation').inputValue(),'newHoles');assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#viewport-depth').fill('5');await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('body-count').textContent==='1'&&document.getElementById('extrude-distance').hidden,null,{timeout:120000});
 const data=await save(),last=data.features.at(-1);assert.equal(last.holesOnly,true);assert.equal(last.region.holes.length,1);assert.ok(last.cadResult.outputs[0].vertices.every((v,i)=>i%3===2||Math.abs(v)<=5.01),'only the inner hole is extruded');
 assert.deepEqual(errors,[]);await page.screenshot({path:'.sites-runtime/holes-only-guard.png'});await context.close();console.log('PASS hole-free rectangle/circle guarded in both controls, responsive camera and normal extrusion, valid hole-only extrusion preserved'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
