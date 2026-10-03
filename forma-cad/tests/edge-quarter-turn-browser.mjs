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
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();const host=page.locator('#canvas-host'),turn=page.locator('#edge-quarter-turn');
 const base={...defaults,id:'upper',name:'上側',kind:'extrusion',width:60,height:40,depth:30};
 async function load(features){await page.locator('#file').setInputFiles({name:'edge-turn.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();const download=await promise;return JSON.parse(await fs.readFile(await download.path(),'utf8'));}
 const bounds=output=>[0,1,2].map(axis=>{const a=output.vertices.filter((_,i)=>i%3===axis);return [Math.min(...a),Math.max(...a)];});
 async function rotate(count){await turn.click();await page.waitForFunction(value=>Number(document.getElementById('feature-count').textContent)===value,count);await page.waitForFunction(()=>!document.getElementById('edge-quarter-turn').disabled);assert.equal(await host.getAttribute('data-selected-edge-count'),'1','rotation keeps the same edge selected for next click');return JSON.parse(await host.getAttribute('data-edge-turn'));}
 await load([base]);assert.equal(await turn.isVisible(),false);await page.locator('#selection-mode').selectOption('edge');await page.mouse.click(...await screen([30,0,0]));await turn.waitFor({state:'visible',timeout:8000});await page.screenshot({path:'.sites-runtime/edge-turn-selected.png'});
 let firstAngle,crossed=false,firstSave;
 for(let i=0;i<4;i++){const state=await rotate(i+2);assert.equal(state.bodyId,'upper');assert.equal(state.continuous,i>0);if(i===0){firstAngle=state.angle;assert.ok(state.minZ>=-1e-5);}else assert.equal(state.angle,firstAngle,'continued presses keep the first direction');if(state.minZ<-.001)crossed=true;const saved=await save(),output=saved.features.at(-1).outputs[0],b=bounds(output);assert.ok(Math.abs(b[2][0]-state.minZ)<1e-4);assert.equal(saved.features.at(-1).spec.target,'upper');if(i===0){firstSave=saved;await page.screenshot({path:'.sites-runtime/edge-turn-first.png'});}if(i===1)await page.screenshot({path:'.sites-runtime/edge-turn-continued.png'});if(i===3)for(let axis=0;axis<3;axis++){assert.ok(Math.abs(b[axis][0]-[-30,-20,0][axis])<1e-4);assert.ok(Math.abs(b[axis][1]-[30,20,30][axis])<1e-4);}}
 assert.ok(crossed);await page.locator('#undo').click();await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='4');assert.equal(await turn.isVisible(),false);await page.locator('#redo').click();await page.waitForFunction(()=>document.getElementById('feature-count').textContent==='5');assert.deepEqual(bounds((await save()).features.at(-1).outputs[0]).map(p=>p.map(v=>Math.round(v)||0)),[[-30,30],[-20,20],[0,30]]);
 await load(firstSave.features);await page.locator('[data-view=left]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);await page.locator('#selection-mode').selectOption('edge');await page.mouse.click(...await screen([30,0,0]));await turn.waitFor({state:'visible',timeout:8000});const fresh=await rotate(3);assert.equal(fresh.continuous,false,'reloaded model starts a new direction decision');assert.ok(fresh.minZ>=-1e-5);
 const lower={...base,id:'lower',name:'下側',z:-20,depth:20};await load([lower,base]);await page.locator('#selection-mode').selectOption('edge');await page.mouse.click(...await screen([30,0,0]));await turn.waitFor({state:'visible',timeout:8000});const upperState=await rotate(3);assert.equal(upperState.bodyId,'upper','shared edge turns upper body');const result=await save();assert.deepEqual(result.features.slice(0,2),[lower,base]);assert.equal(result.features.at(-1).spec.target,'upper');assert.equal(result.features.at(-1).outputs.length,1,'lower body remains unchanged');
 await page.locator('#selection-mode').selectOption('body');await page.locator('#bodies [data-body-id=lower] .row-label').click();assert.equal(await turn.isVisible(),false);const circle={...base,id:'circle',profile:'circle',diameter:60};await load([circle]);await page.locator('#selection-mode').selectOption('edge');await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);await page.mouse.click(...await screen([30,0,30]));await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.selectedEdge==='true');assert.equal(await turn.isVisible(),false,'circular edges do not offer this operation');assert.deepEqual(errors,[]);await context.close();console.log('PASS selected edge quarter-turn UI, first nonnegative direction, continuous direction including negative Z, four turns, exact saved bounds, undo/redo/reload, upper shared body, unchanged lower body and invalid selection visibility'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
