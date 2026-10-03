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


 const host=page.locator('#canvas-host'),scope=page.locator('#face-grid-scope');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:20};
 await page.locator('#file').setInputFiles({name:'visibility.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box]}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.mouse.move(20,20);await page.waitForTimeout(120);
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function pixels(point){const p=await screen(point),shot=await page.screenshot();return page.evaluate(async({data,p})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return Array.from({length:7},(_,i)=>Array.from(ctx.getImageData(Math.round(p[0])+i-3,Math.round(p[1]),1,1).data));},{data:shot.toString('base64'),p});}
 const gray=row=>row.some(rgb=>Math.max(...rgb.slice(0,3))<229&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<25);
 assert.ok(gray(await pixels([40,-13,0])),'minor origin grid lines are clearly visible beside a solid');await page.screenshot({path:'.sites-runtime/grid-solid-readable.png'});
 await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([15,-5,20]));await page.mouse.move(20,20);await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');assert.equal(await host.getAttribute('data-grid-visible'),'true','origin grid remains visible while selected face grid is shown');assert.ok(gray(await pixels([40,-13,0])),'origin grid remains drawn outside selected face');const purple=await pixels([10,-13,20]);assert.ok(purple.some(rgb=>rgb[0]>rgb[1]+20&&rgb[2]>rgb[1]+40),'purple grid stays readable over selected blue solid');await page.screenshot({path:'.sites-runtime/grid-origin-and-selected.png'});
 for(const mode of ['200','unlimited','face']){await scope.selectOption(mode);await page.waitForFunction(value=>document.getElementById('canvas-host').dataset.faceGridScope===value,mode);assert.equal(await host.getAttribute('data-grid-visible'),'true');assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true');}
 await page.locator('[data-grid-plane=CUSTOM]').uncheck();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='false');assert.equal(await host.getAttribute('data-grid-visible'),'true','turning off working grid preserves origin grid');await page.locator('[data-grid-plane=CUSTOM]').check();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');
 await page.locator('[data-grid-plane=XY]').uncheck();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.gridVisible==='false');assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true','origin toggle is independent of selected face grid');await page.locator('[data-grid-plane=XY]').check();await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.gridVisible==='true');
 await page.keyboard.press('Escape');await page.locator('[data-view=iso]').click();await page.waitForTimeout(100);await page.mouse.click(...await screen([30,0,10]));await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.sketchGridVisible==='true');assert.equal(await host.getAttribute('data-grid-visible'),'true');assert.equal(await host.getAttribute('data-visible-axes'),'XYZ','origin and side-face axes remain visible');await page.screenshot({path:'.sites-runtime/grid-origin-and-side.png'});
 await page.locator('#new-line').click();await page.waitForTimeout(120);assert.equal(await host.getAttribute('data-grid-visible'),'true','origin remains enabled during sketching');assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true');assert.deepEqual(errors,[]);await context.close();console.log('PASS readable origin and solid-face grid pixels, simultaneous grid display in all scopes, independent origin/working toggles, side-face axes and sketching'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
