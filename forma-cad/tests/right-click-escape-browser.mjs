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
 const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){if(window.holdMove&&m.spec?.type==='move'){window.moveHeld=true;return;}return post.call(this,m,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host'),canvas=page.locator('canvas');
 const box={...defaults,id:'box',name:'本体',kind:'extrusion',width:60,height:40,depth:30};
 const line={...defaults,id:'line',name:'確定した線',kind:'sketch',mode:'thin',profile:'line',width:40,angle:0,groupId:'g',groupNumber:1};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'right-click.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function blank(){const r=await canvas.boundingBox();for(const [x,y]of [[.12,.5],[.85,.65],[.4,.85]]){const p=[r.x+r.width*x,r.y+r.height*y];if(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)===document.querySelector('canvas'),p))return p;}throw Error('No clear canvas point');}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function snapshot(){return page.evaluate(()=>{const h=document.getElementById('canvas-host');return {mode:document.getElementById('workspace-mode').textContent,selection:document.getElementById('selection-mode').value,counts:['body','face','edge','sketch'].map(k=>h.dataset['selected'+k[0].toUpperCase()+k.slice(1)+'Count']),preview:h.dataset.previewKind,features:document.getElementById('feature-count').textContent,panels:['measurement','hole-panel','move-panel','extrude-distance','sketch-banner'].map(id=>!document.getElementById(id).hidden)};});}
 async function clearRight(){await page.mouse.click(...await blank(),{button:'right'});await page.waitForFunction(()=>document.getElementById('selection-summary').textContent==='選択なし'&&document.getElementById('workspace-mode').textContent==='ソリッド');assert.equal(await page.locator('#selection-mode').inputValue(),'auto');assert.equal(await page.locator('#measurement').isVisible(),false);assert.equal(await host.getAttribute('data-preview-kind'),'none');assert.equal(await page.locator('#solid-face-menu,#sketch-group-menu').count(),0);}
 await load([box]);const original=(await save()).features;
 // Right click and Escape yield the same selection state and preserve camera/model.
 for(const mode of ['body','face','edge']){
  async function select(){await page.locator('#selection-mode').selectOption(mode);if(mode==='body')await page.locator('#bodies .row-label').first().click();else await page.mouse.click(...await screen(mode==='edge'?[30,0,30]:[0,0,30]));assert.ok(Number(await host.getAttribute('data-selected-'+mode+'-count'))>0);}
  await select();await page.keyboard.press('Escape');const expected=await snapshot();await select();const camera=await host.getAttribute('data-camera-state');await clearRight();assert.deepEqual(await snapshot(),expected,mode+' right click matches Escape');assert.equal(await host.getAttribute('data-camera-state'),camera,'cancel preserves camera');
 }
 assert.deepEqual((await save()).features,original,'cancel never changes committed geometry');
 // A planar face still opens its original menu, not Escape.
 await page.mouse.click(...await screen([0,0,30]),{button:'right'});await page.locator('#context-opposite-face-ground').waitFor();assert.equal(await host.getAttribute('data-selected-face-count'),'1');await page.keyboard.press('Escape');assert.equal(await host.getAttribute('data-selected-face-count'),'1','Escape closes menu first');
 await page.mouse.click(...await screen([0,0,30]),{button:'right'});await page.locator('#context-opposite-face-ground').waitFor();await page.mouse.click(...await blank(),{button:'right'});assert.equal(await page.locator('#solid-face-menu').count(),0);assert.equal(await host.getAttribute('data-selected-face-count'),'1','right click closes menu exactly like Escape');await clearRight();
 // Right drag pans without cancelling the current selection, including an out-and-back drag.
 await page.locator('#selection-mode').selectOption('body');await page.locator('#bodies .row-label').first().click();let start=await blank(),before=JSON.parse(await host.getAttribute('data-camera-state'));
 await page.mouse.move(...start);await page.mouse.down({button:'right'});await page.mouse.move(start[0]+65,start[1]+35,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(150);assert.equal(await host.getAttribute('data-selected-body-count'),'1');assert.equal(await page.locator('#selection-mode').inputValue(),'body');assert.equal(await page.locator('#solid-face-menu').count(),0);assert.ok(JSON.parse(await host.getAttribute('data-camera-state')).some((v,i)=>Math.abs(v-before[i])>.001),'right drag pans');
 start=await blank();await page.mouse.move(...start);await page.mouse.down({button:'right'});await page.mouse.move(start[0]+40,start[1]+20,{steps:3});await page.mouse.move(...start,{steps:3});await page.mouse.up({button:'right'});assert.equal(await host.getAttribute('data-selected-body-count'),'1','drag returning to start is still a drag');await clearRight();
 // Move and section tools cancel through the shared action, even with a field focused.
 await page.locator('#move-tool').click();await page.mouse.click(...await screen([0,0,30]));await page.locator('#move-x').fill('5');await page.locator('#move-x').focus();await clearRight();assert.equal(await page.locator('#move-panel').isVisible(),false);assert.deepEqual((await save()).features,original);
 await page.locator('#cut-tool').click();await page.mouse.click(...await screen([0,0,30]));await page.locator('#hole-diameter').focus();await clearRight();assert.equal(await page.locator('#hole-panel').isVisible(),false);
 await page.locator('#move-tool').click();await page.mouse.click(...await screen([0,0,30]));await page.locator('#move-x').fill('7');await page.evaluate(()=>window.holdMove=true);await page.locator('#move-apply').click();await page.waitForFunction(()=>window.moveHeld);await clearRight();await page.evaluate(()=>window.holdMove=false);assert.deepEqual((await save()).features,original,'right click cancels an in-flight operation without committing');
 await page.locator('#section-toggle').click();assert.equal(await host.getAttribute('data-section-active'),'true');await clearRight();assert.equal(await host.getAttribute('data-section-active'),'false');
 await load([line]);const savedLine=(await save()).features;
 // Selected sketch and tree menus retain their old commands.
 await page.locator('#select-sketch-edge').click();await page.mouse.click(...await screen([10,0,0]));await page.mouse.click(...await screen([10,0,0]),{button:'right'});await page.locator('#sketch-group-menu').waitFor();assert.match(await page.locator('#sketch-group-menu').textContent(),/続きから描く/);await page.locator('#sketch-group-menu').click();assert.equal(await page.locator('#workspace-mode').textContent(),'スケッチ');await clearRight();
 await page.locator('#sketches .tree-row').first().click({button:'right'});await page.locator('#sketch-group-menu').waitFor();assert.equal(await page.locator('#sketch-group-menu').textContent(),'再編集');await page.keyboard.press('Escape');
 // Cancelling a partially drawn primitive keeps existing sketch members.
 for(const id of ['new-line','new-circle','new-rect','new-polygon','new-point','new-spline']){
  await page.locator('#'+id).click();if(id!=='new-point'){const r=await canvas.boundingBox();await page.mouse.click(r.x+r.width*.7,r.y+r.height*.6);await page.mouse.move(r.x+r.width*.75,r.y+r.height*.55);}
  await clearRight();assert.equal(await page.locator('#'+id).getAttribute('aria-pressed'),'false');
 }
 assert.deepEqual((await save()).features,savedLine);
 // Extrusion preview and focused distance input cancel without committing.
 const rectangle={...line,id:'rect',profile:'rect',width:40,height:30};await load([rectangle]);await page.mouse.click(...await screen([0,0,0]));await page.locator('#solid-tool').click();await page.locator('#extrude-distance').waitFor({state:'visible'});await page.locator('#viewport-depth').fill('25');await page.locator('#viewport-depth').focus();await clearRight();assert.equal(await page.locator('#extrude-distance').isVisible(),false);assert.equal(await page.locator('#feature-count').textContent(),'1');
 // Repeated right clicks and subsequent keyboard Escape remain independent.
 await page.locator('#new-line').click();await clearRight();await page.locator('#new-circle').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#workspace-mode').textContent(),'ソリッド');await page.locator('#new-rect').click();await clearRight();
 assert.deepEqual(errors,[]);await context.close();console.log('PASS right-click Escape equivalence, unchanged model/camera, sketch/face/tree menus, right-drag and out-and-back drag, move/section/draft/extrusion cancellation and keyboard state'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
