import * as THREE from 'three';
import {defaults,rebuild,volume} from '../src/geometry.js';
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
 const context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),panel=page.locator('#extrude-distance'),sketch={...defaults,id:'sketch',name:'原点スケッチ',kind:'sketch',width:30,height:20};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'view.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(150);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function camera(){return {state:JSON.parse(await host.getAttribute('data-camera-state')),target:JSON.parse(await host.getAttribute('data-camera-target'))};}
 async function begin(expectTilt,tool='#solid-tool'){const before=await camera();await page.locator(tool).click();await panel.waitFor();await page.waitForTimeout(120);const after=await camera();if(expectTilt){assert.ok(Math.hypot(...before.state.slice(3,7).map((v,i)=>v-after.state[i+3]))>.1,'initial origin-plane extrusion reveals depth');assert.equal(after.state[7],before.state[7],'initial adjustment retains zoom');assert.equal(await page.locator('#view-label').textContent(),'俯瞰');}else{assert.ok(after.state.every((v,i)=>Math.abs(v-before.state[i])<1e-6),'later extrusion retains position, direction and zoom: '+JSON.stringify({before,after,features:await page.locator('#features').textContent()}));assert.ok(after.target.every((v,i)=>Math.abs(v-before.target[i])<1e-6),'later extrusion retains camera target');}await page.keyboard.press('Escape');}
 async function selectRegion(point){await page.mouse.click(...await screen(point));await page.waitForTimeout(100);assert.match(await page.locator('#region-selection').textContent(),/1 領域/);}
 await load([sketch]);await selectRegion([5,2,0]);await begin(true);
 await load([sketch]);await page.locator('[data-view=iso]').click();await selectRegion([5,2,0]);await begin(false);
 const other={...defaults,id:'body',name:'本体',kind:'extrusion',x:60,width:20,height:20,depth:20};
 await load([other,sketch]);await selectRegion([5,2,0]);await begin(false);
 await load([{...sketch,z:15}]);await selectRegion([5,2,15]);await begin(false);
 const box={...other,x:0,width:25,height:25};
 await load([box]);await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([9,-7,20]));if(await page.locator('#selection-candidates').isVisible()){await page.locator('#selection-candidates [data-kind=face]').filter({hasText:'上面'}).first().click();await page.locator('#selection-candidates [data-close]').click();}await begin(false);
 const line={...sketch,profile:'line',mode:'thin',name:'原点の線分'};
 await load([line]);await page.locator('#sketches [data-sketch-group] .row-label').first().click();await begin(true,'#thin-tool');
 await load([other,line]);await page.locator('#sketches [data-sketch-group] .row-label').first().click();await begin(false,'#thin-tool');
 assert.deepEqual(errors,[]);console.log('PASS initial origin sketch reveals depth; existing-body, offset plane, solid-face and later thin extrusions preserve view');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
