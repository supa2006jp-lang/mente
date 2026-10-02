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
 const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const features=[{...defaults,id:'x',name:'X軸上の線',kind:'sketch',profile:'line',mode:'thin',width:60,groupId:'g',groupNumber:1},{...defaults,id:'y',name:'Y軸上の線',kind:'sketch',profile:'line',mode:'thin',width:60,angle:90,groupId:'g',groupNumber:1}];
 await page.locator('#file').setInputFiles({name:'axes.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.mouse.move(20,20);await page.waitForTimeout(200);
 async function point(x,y){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const q=new THREE.Vector3(x,y,0).project(c);return [r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2];}
 async function pixels(x,y,vertical){const p=await point(x,y),shot=await page.screenshot();return page.evaluate(async({data,p,vertical})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return Array.from({length:11},(_,i)=>Array.from(ctx.getImageData(Math.round(p[0])+(vertical?i-5:0),Math.round(p[1])+(vertical?0:i-5),1,1).data));},{data:shot.toString('base64'),p,vertical});}
 const blue=rgb=>rgb[2]>rgb[0]+50&&rgb[2]>rgb[1]+30&&rgb[0]<100,white=rgb=>rgb.slice(0,3).every(v=>v>245);
 for(const [x,y,vertical] of [[15,0,false],[0,15,true]]){const row=await pixels(x,y,vertical);assert.ok(row.filter(blue).length>=2,'sketch stroke stays blue and thick over axis');assert.ok(row.filter(white).length>=3,'white border separates sketch from axis');}
 const beyond=await pixels(0,40,true);assert.ok(beyond.some(rgb=>rgb[1]>rgb[0]+25&&rgb[1]>rgb[2]+25),'Y axis remains green beyond sketch endpoints');
 await page.screenshot({path:'.sites-runtime/sketch-axis-visible.png'});
 await page.mouse.click(...await point(15,0));assert.match(await page.locator('#measurement-length').textContent(),/60 mm/,'original sketch remains selectable');
 await page.keyboard.press('Escape');await page.locator('#new-line').click();await page.mouse.click(...await point(-20,0));await page.mouse.move(...await point(20,0));await page.waitForTimeout(150);
 const previewPixels=await pixels(-10,0,false);await page.screenshot({path:'.sites-runtime/sketch-axis-preview.png'});assert.ok(previewPixels.some(rgb=>rgb[0]<100&&rgb[1]>100&&rgb[2]>140&&rgb[2]>rgb[0]+50),'drawing preview remains visible above axis');
 await page.keyboard.press('Escape');if(await page.locator('#finish-sketch-tool').isVisible())await page.locator('#finish-sketch-tool').click();await page.waitForTimeout(100);
 await page.getByRole('button',{name:'スケッチを非表示',exact:true}).click();const hidden=await pixels(15,0,false);assert.equal(hidden.filter(blue).length,0,'hiding a sketch hides its wide strokes');assert.ok(hidden.some(rgb=>rgb[0]>rgb[1]+30),'X axis is visible after hiding sketch');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS thick white-bordered X/Y axis sketches, original picking, drawing preview and sketch visibility'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
