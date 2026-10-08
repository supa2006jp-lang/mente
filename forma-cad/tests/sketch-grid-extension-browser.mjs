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


 const host=page.locator('#canvas-host'),scope=page.locator('#face-grid-scope');
 const box={...defaults,id:'box',kind:'extrusion',name:'本体',width:60,height:40,depth:20};
 await page.locator('#file').setInputFiles({name:'visibility.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features:[box]}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.mouse.move(20,20);await page.waitForTimeout(120);
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function pixels(point){const p=await screen(point),shot=await page.screenshot();return page.evaluate(async({data,p})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return Array.from({length:7},(_,i)=>Array.from(ctx.getImageData(Math.round(p[0])+i-3,Math.round(p[1]),1,1).data));},{data:shot.toString('base64'),p});}

 const purple=row=>row.some(rgb=>rgb[0]>rgb[1]+20&&rgb[2]>rgb[1]+40);
 await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([15,-5,20]));await page.locator('#selection-candidates').waitFor();await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'上面'}).click();await page.locator('#selection-candidates [data-close]').click();await scope.selectOption('face');await page.locator('#new-line').click();await page.waitForTimeout(120);
 const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);for(let i=0;i<5;i++){await page.mouse.wheel(0,200);await page.waitForTimeout(30);}await page.waitForTimeout(100);
 await page.mouse.click(...await screen([0,-5,20]));await page.mouse.move(...await screen([40.1,40.1,20]));await page.waitForTimeout(100);
 let patches=JSON.parse(await host.getAttribute('data-sketch-grid-extensions'));assert.equal(patches.length,1);assert.deepEqual(patches[0],{u:[20,60],v:[20,60]});assert.equal(await host.getAttribute('data-snap-kind'),'grid');assert.ok(purple(await pixels([40,35,20])),'grid appears around outside endpoint');assert.ok(!purple(await pixels([-40,35,20])),'grid stays absent in unrelated empty space');
 await page.mouse.move(...await screen([15,5,20]));await page.waitForTimeout(100);assert.deepEqual(JSON.parse(await host.getAttribute('data-sketch-grid-extensions')),[],'temporary patch vanishes when endpoint returns to face');
 await page.mouse.move(...await screen([40.1,40.1,20]));await page.waitForTimeout(80);await page.mouse.click(...await screen([40.1,40.1,20]));await page.mouse.move(...await screen([15,5,20]));await page.waitForTimeout(120);patches=JSON.parse(await host.getAttribute('data-sketch-grid-extensions'));assert.ok(patches.some(p=>p.u[0]===20&&p.v[0]===20),'confirmed outside endpoint retains grid');assert.ok(purple(await pixels([40,35,20])),'confirmed patch stays rendered');
 const downloaded=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await downloaded).path(),'utf8')),line=saved.features.at(-1);assert.equal(line.kind,'sketch');assert.equal(line.profile,'line');const b={u:new THREE.Vector3(...line.frame.u),v:new THREE.Vector3(...line.frame.v)},a=line.angle*Math.PI/180,endpoint=new THREE.Vector3(line.x,line.y,line.z).addScaledVector(b.u,line.width/2*Math.cos(a)).addScaledVector(b.v,line.width/2*Math.sin(a));assert.ok(endpoint.distanceTo(new THREE.Vector3(40,40,20))<.001,'clicked endpoint snaps to displayed intersection');
 await page.locator('#new-rect').click();await page.waitForTimeout(120);assert.ok(JSON.parse(await host.getAttribute('data-sketch-grid-extensions')).length>0,'patches survive tool switching');await scope.selectOption('100');await page.waitForTimeout(100);assert.deepEqual(JSON.parse(await host.getAttribute('data-sketch-grid-extensions')),[],'fixed-size scope needs no patches');await scope.selectOption('face');await page.waitForTimeout(100);assert.ok(JSON.parse(await host.getAttribute('data-sketch-grid-extensions')).length>0);await page.mouse.move(20,20);await page.screenshot({path:'.sites-runtime/sketch-local-grid.png'});await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await host.getAttribute('data-sketch-grid-visible'),'false');assert.deepEqual(errors,[]);
 console.log('PASS local outside endpoint grid, no unrelated expansion, cursor return, persistent confirmed sketch points, grid intersection snapping and tool/scope switching');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
