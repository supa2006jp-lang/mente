import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {trimSketch} from '../src/trim-sketch.js';
import {findRegions} from '../src/regions.js';
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
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);
 await page.locator('canvas').waitFor();
 const cylinder={...defaults,id:'c',name:'円柱',profile:'circle',diameter:20,depth:10};
 const cut={...defaults,id:'cut',name:'半分カット',width:20,height:30,depth:10,x:10,operation:'cut',target:'c'};
 async function load(features){await page.locator('#file').setInputFiles({name:'arc.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open&&document.getElementById('body-count').textContent==='1');await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.locator('#selection-mode').selectOption('edge');}
 async function point(x,y,z=10){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const q=new THREE.Vector3(x,y,z).project(c);return [r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2];}
 async function click(x,y){await page.mouse.click(...await point(x,y));await page.mouse.move(20,20);await page.waitForTimeout(100);}
 await load([cylinder,cut]);await click(-10,0);
 assert.equal(await page.locator('#measurement-title').textContent(),'選択した円弧');assert.match(await page.locator('#measurement-length').textContent(),/31\.42/);assert.match(await page.locator('#measurement-angle').textContent(),/半径 10 mm/);
 const selectedPath=await page.locator('#edge-overlay-line').getAttribute('d');assert.ok(selectedPath.split('L').length>=64,'whole semicircle highlighted');
 const ends=await page.locator('#edge-end-a').evaluate(a=>[+a.getAttribute('cx'),+a.getAttribute('cy')]);const r=await page.locator('canvas').boundingBox(),projected=await point(0,10);assert.ok(Math.hypot(ends[0]+r.x-projected[0],ends[1]+r.y-projected[1])<2||Math.hypot(ends[0]+r.x-projected[0],ends[1]+r.y-(await point(0,-10))[1])<2,'marker is at real arc endpoint');
 await page.keyboard.down('Control');await click(-Math.SQRT1_2*10,Math.SQRT1_2*10);assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-edge-count'),'0','another chord toggles same whole arc');await click(-Math.SQRT1_2*10,-Math.SQRT1_2*10);assert.equal(await page.locator('#canvas-host').getAttribute('data-selected-edge-count'),'1');await page.keyboard.up('Control');
 await click(0,0);assert.equal(await page.locator('#measurement-title').textContent(),'選択した辺');assert.ok(parseFloat(await page.locator('#measurement-length').textContent())>0);assert.equal((await page.locator('#edge-overlay-line').getAttribute('d')).split('L').length,2,'straight cut edge stays separate from arc');
 await click(-10,0);await page.screenshot({path:'.sites-runtime/arc-edge-selected.png'});
 if(!process.env.FORMA_TEST_URL){
  await page.locator('#edge-fillet').click();await page.locator('#cad-radius').fill('1');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,null,{timeout:120000});assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
  const event=page.waitForEvent('download');await page.locator('#save').click();const saved=JSON.parse(await fs.readFile(await(await event).path(),'utf8'));assert.equal(saved.features.at(-1).spec.edges.length,64,'fillet receives every part of selected arc');assert.ok(saved.features.at(-1).outputs[0].triangles.length>0);
 }
 await load([cylinder]);await click(-10,0);assert.equal(await page.locator('#measurement-title').textContent(),'選択した円周');assert.match(await page.locator('#measurement-length').textContent(),/62\.83/);assert.equal(await page.locator('#edge-end-a').isVisible(),false);
 const sketch={...defaults,kind:'sketch',profile:'circle',diameter:20,id:'circle',groupId:'g'},line={...defaults,kind:'sketch',profile:'line',mode:'thin',width:30,id:'line',groupId:'g'};
 const trimmed=trimSketch(sketch,[sketch,line],new THREE.Vector3(0,-10,0)),region=findRegions([...trimmed,line])[0];assert.ok(region);
 await load([{...defaults,id:'trimmed',name:'トリムから押し出し',profile:'region',region,depth:10}]);await click(0,10);assert.equal(await page.locator('#measurement-title').textContent(),'選択した円弧');assert.match(await page.locator('#measurement-length').textContent(),/31\.42/);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS cut semicircle and trimmed sketch extrusion, whole arc highlight, actual endpoints, same-arc toggle, straight cut edge, full circle'+(process.env.FORMA_TEST_URL?' on live site':' and full arc fillet'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
