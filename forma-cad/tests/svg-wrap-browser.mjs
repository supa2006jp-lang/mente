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

 const host=page.locator('#canvas-host'),base={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:40,depth:40};
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path fill-rule="evenodd" d="M0 5H100V35H0Z M25 15H75V25H25Z"/></svg>';
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'wrap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=front]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function open(){await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([0,-20,20]));assert.match(await page.locator('#measurement-title').textContent(),/円柱/);await page.locator('#wrap-selected-cylinder').click();await page.locator('#svg-wrap-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('svg-wrap-info').textContent.includes('円周'));}
 async function ready(){await page.waitForFunction(()=>!document.getElementById('svg-wrap-apply').disabled&&document.getElementById('canvas-host').dataset.svgWrapPreview==='true',null,{timeout:90000});}
 await load([base]);await open();assert.equal(await page.locator('#svg-wrap-depth').inputValue(),'0.6');assert.equal(await page.locator('#svg-wrap-seam').inputValue(),'repeat');await page.locator('#svg-wrap-seam').selectOption('mirror');assert.ok(await page.locator('#svg-wrap-apply').isDisabled());
 await page.locator('#svg-wrap-file').setInputFiles({name:'band.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await ready();assert.ok(await page.locator('#svg-wrap-flat path').count()>0);assert.match(await page.locator('#svg-wrap-info').textContent(),/125.66/);await page.locator('[data-view=iso]').click();await page.screenshot({path:'.sites-runtime/svg-wrap-preview.png'});
 await page.locator('#svg-wrap-depth').fill('0');await page.waitForTimeout(100);assert.ok(await page.locator('#svg-wrap-apply').isDisabled());assert.equal(await host.getAttribute('data-svg-wrap-preview'),null);await page.locator('#svg-wrap-depth').fill('0.6');await ready();
 await page.locator('#svg-wrap-apply').click();await page.waitForFunction(()=>!document.getElementById('svg-wrap-dialog').open&&document.getElementById('feature-count').textContent==='2');const saved=await save();assert.equal(saved.features[1].spec.type,'svgWrap');assert.equal(saved.features[1].spec.depth,.6);assert.equal(saved.features[1].spec.fileName,'band.svg');assert.equal(saved.features[1].spec.seam,'mirror');assert.equal(await host.getAttribute('data-svg-wrap-preview'),null);assert.equal(await page.locator('#body-count').textContent(),'1');
 await page.locator('#undo').click();assert.equal(await page.locator('#feature-count').textContent(),'1');await page.locator('#redo').click();assert.equal(await page.locator('#feature-count').textContent(),'2');
 await load(saved.features);await page.locator('#features .row-label').last().click();await page.locator('#svg-wrap-dialog').waitFor({state:'visible'});await ready();assert.equal(await page.locator('#svg-wrap-filename').textContent(),'band.svg');assert.equal(await page.locator('#svg-wrap-apply').textContent(),'変更を適用');await page.locator('#svg-wrap-operation').selectOption('engrave');await page.locator('#svg-wrap-seam').selectOption('single');await page.locator('#svg-wrap-angle').fill('30');await ready();await page.locator('#svg-wrap-apply').click();try{await page.waitForFunction(()=>!document.getElementById('svg-wrap-dialog').open);}catch(e){console.log('EDIT',await page.locator('#svg-wrap-error').textContent(),errors);throw e;}const changed=await save();assert.equal(changed.features.length,2);assert.equal(changed.features[1].spec.operation,'engrave');assert.equal(changed.features[1].spec.seam,'single');assert.equal(changed.features[1].spec.angle,30);
 // Cancel a valid preview and an in-flight calculation without changing the saved model.
 await load([base]);await open();await page.locator('#svg-wrap-file').setInputFiles({name:'stroke.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path fill="none" stroke="black" stroke-width="4" d="M0 20L50 10L100 20"/></svg>')});await ready();await page.locator('#svg-wrap-depth').fill('0.8');await page.keyboard.press('Escape');assert.equal(await host.getAttribute('data-svg-wrap-preview'),null);await page.waitForTimeout(700);assert.equal(await page.locator('#feature-count').textContent(),'1');assert.deepEqual((await save()).features,[base]);
 await open();await page.locator('#svg-wrap-file').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});await page.waitForFunction(()=>document.getElementById('svg-wrap-error').textContent.includes('パス'));assert.ok(await page.locator('#svg-wrap-apply').isDisabled());await page.keyboard.press('Escape');

 // The command is also reachable when the toolbar button is hidden on narrow windows.
 await page.mouse.click(...await screen([0,-20,20]));await page.locator('#advanced-tools').click();await page.locator('#cad-command').selectOption('svgWrap');await page.locator('#svg-wrap-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('svg-wrap-file').disabled);await page.keyboard.press('Escape');
 // Hold the worker request to test a genuine pending preview cancellation.
 await page.evaluate(()=>{window.svgOriginalPost=Worker.prototype.postMessage;window.svgHeld=false;Worker.prototype.postMessage=function(payload,...rest){if(payload.spec?.type==='svgWrap'){window.svgHeld=true;return;}return window.svgOriginalPost.call(this,payload,...rest);};});
 await open();await page.locator('#svg-wrap-file').setInputFiles({name:'pending.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.waitForFunction(()=>window.svgHeld);assert.ok(await page.locator('#svg-wrap-apply').isDisabled());await page.locator('#svg-wrap-cancel').click();await page.evaluate(()=>{Worker.prototype.postMessage=window.svgOriginalPost;});await page.waitForTimeout(400);assert.equal(await page.locator('#feature-count').textContent(),'1');assert.equal(await host.getAttribute('data-svg-wrap-preview'),null);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS SVG side-face selection, file/stroke import, mirror/single wrap, exact preview, disabled invalid depth, commit/save/reedit/reload/undo/redo, cancelled and unsafe files'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
