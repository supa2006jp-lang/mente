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

 const handle=page.locator('#extrude-handle'),wheel=page.locator('#extrude-operation-wheel'),main=page.locator('#depth'),floating=page.locator('#viewport-depth');
 const normal=f=>f.frame?.n||({XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[f.plane]);
 async function load(features){await page.locator('#file').setInputFiles({name:'drag.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('#features .row-label').last().click();await wheel.waitFor();await page.locator('[data-view=iso]').click();await page.waitForTimeout(100);}
 async function axis(f){const r=await page.locator('canvas').boundingBox(),state=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(state);c.quaternion.fromArray(state,3);c.zoom=state[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const base=new THREE.Vector3(f.x,f.y,f.z),a=base.clone().project(c),b=base.clone().add(new THREE.Vector3(...normal(f))).project(c);let dx=(b.x-a.x)*r.width/2,dy=-(b.y-a.y)*r.height/2;if(Math.hypot(dx,dy)<.1){dx=0;dy=-r.height/(200/c.zoom);}return {dx,dy};}
 async function direction(f){await page.waitForTimeout(60);const a=await axis(f),depth=Number(await page.locator('#depth').inputValue()),sign=depth<0?-1:1,angle=await handle.evaluate(e=>Number(e.style.transform.match(/rotate\(([-+0-9.e]+)deg\)/)[1])*Math.PI/180);assert.ok((Math.sin(angle)*a.dx*sign-Math.cos(angle)*a.dy*sign)/Math.hypot(a.dx,a.dy)>.999,'arrow points along the signed extrusion direction');}
 async function drag(f,target){const a=await axis(f),r=await handle.boundingBox(),depth=Number(await page.locator('#depth').inputValue()),x=r.x+r.width/2,y=r.y+r.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+a.dx*(target-depth),y+a.dy*(target-depth),{steps:8});await page.waitForTimeout(60);const result={value:Number(await page.locator('#depth').inputValue()),snapped:await handle.getAttribute('data-snapped')==='true'};await direction(f);await page.mouse.up();assert.equal(await handle.getAttribute('data-snapped'),null,'snap indicator is cleared after dragging');return result;}

 const draft={...defaults,id:'s',name:'押し出し',kind:'extrusion',width:40,height:30,depth:30.95701356945974};
 async function both(value){assert.equal(await main.inputValue(),value,'sidebar distance');assert.equal(await floating.inputValue(),value,'floating distance');}
 async function commit(){if(await handle.isVisible())await handle.click();else await page.locator('#apply').click();await page.locator('#extrude-distance').waitFor({state:'hidden'});const download=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await download).path(),'utf8')).features.at(-1);}
 async function blur(input){await input.evaluate(e=>e.blur());await page.waitForTimeout(80);}
 await load([draft]);await both('30.96');await main.focus();await blur(main);await both('30.96');assert.equal((await commit()).depth,draft.depth,'unchanged edit preserves precise model distance');
 await load([{...draft,depth:-30.95701356945974}]);await both('-30.96');await main.fill('-12.34567');assert.equal(await main.inputValue(),'-12.34567','typing is not interrupted');await blur(main);await both('-12.35');assert.equal((await commit()).depth,-12.34567,'sidebar formatting preserves entered precision');
 await load([draft]);await main.fill('30.96');await blur(main);await both('30.96');assert.equal((await commit()).depth,30.96,'explicit input replaces the previous precise value even when rounded display is identical');
 await load([draft]);await floating.fill('31.234567');assert.equal(await floating.inputValue(),'31.234567','floating typing is not interrupted');assert.equal(await main.inputValue(),'31.23');await blur(floating);await both('31.23');assert.equal((await commit()).depth,31.234567,'floating formatting preserves entered precision');
 await load([draft]);await floating.fill('');await blur(floating);await both('');await floating.fill('5');await blur(floating);await both('5');assert.equal((await commit()).depth,5,'empty field is not converted to zero and recovers after valid input');
 await load([{...draft,z:12.34567,depth:-5}]);await page.locator('#grid-extent').check();await both('-12.35');assert.equal((await commit()).depth,-12.34567,'grid endpoint remains exact');
 await load([{...draft,depth:5}]);await page.locator('#snap-enabled').uncheck();await drag(draft,17.789123);const display=await main.inputValue();assert.match(display,/^-?\d+(?:\.\d{1,2})?$/,'drag display has at most two decimal places');await both(display);const saved=await commit();assert.equal(display,String(Number(saved.depth.toFixed(2))));assert.ok(Math.abs(saved.depth-Number(display))>1e-8,'free drag retains internal precision');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS two-decimal sidebar/floating display, signed distances, free drag, uninterrupted typing, empty recovery, exact saved/re-edited/grid distances'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
