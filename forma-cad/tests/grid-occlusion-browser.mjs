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

 const isPurple=row=>row.some(rgb=>rgb[0]>rgb[1]+20&&rgb[2]>rgb[1]+40);
 for(const mode of ['face','100','200','unlimited']){
  await scope.selectOption(mode);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.mouse.move(20,20);await page.waitForTimeout(120);
  assert.ok(isPurple(await pixels([10,-13,20])),mode+': purple grid readable on front face');
  await page.locator('[data-view=bottom]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);
  assert.equal(await host.getAttribute('data-sketch-grid-visible'),'true');assert.ok(!isPurple(await pixels([10,-13,20])),mode+': back face blocks purple grid');
  if(mode!=='face'){await page.locator('[data-grid-plane=XY]').uncheck();await page.waitForTimeout(80);assert.ok(isPurple(await pixels([40,-13,20])),mode+': unobstructed grid outside solid remains visible');await page.locator('[data-grid-plane=XY]').check();}
 }
 await page.screenshot({path:'.sites-runtime/grid-back-occluded.png'});
 // The same occlusion works on a vertical side face.
 await page.keyboard.press('Escape');await page.locator('[data-view=right]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(100);await page.mouse.click(...await screen([30,6,13]));await page.locator('#selection-candidates').waitFor();await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'X＋'}).click();await page.locator('#selection-candidates [data-close]').click();await scope.selectOption('100');await page.mouse.move(20,20);await page.waitForTimeout(120);assert.ok(isPurple(await pixels([30,10,13])),'side face grid stays readable');
 await page.locator('[data-view=left]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);assert.ok(!isPurple(await pixels([30,10,13])),'opposite side blocks selected side grid');assert.ok(isPurple(await pixels([30,30,13])),'side grid outside solid stays visible');
 // An independent solid in front also occludes the working grid.
 await page.keyboard.press('Escape');const blocker={...box,id:'blocker',width:8,height:8,depth:10,x:10,y:-13,z:30};await page.locator('#file').setInputFiles({name:'blocked.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box,blocker]}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(120);await page.mouse.click(...await screen([-15,-5,20]));await page.locator('#selection-candidates').waitFor();await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'上面'}).first().click();await page.locator('#selection-candidates [data-close]').click();await scope.selectOption('100');await page.mouse.move(20,20);await page.waitForTimeout(120);assert.ok(isPurple(await pixels([-10,-13,20])),'unblocked portion remains visible');assert.ok(!isPurple(await pixels([10,-13,20])),'independent front solid blocks grid');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS purple grid visible on front, hidden through back/opposite/independent solids, and visible outside solids in face/100/200/unlimited scopes');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
