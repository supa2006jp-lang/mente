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
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec)window.cadJobs.push(payload.spec.type);return post.call(this,payload,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();

 const host=page.locator('#canvas-host'),base={...defaults,id:'cylinder',name:'円柱',kind:'extrusion',profile:'circle',diameter:40,depth:40};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'wrap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=front]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function open(){await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([0,-20,20]));assert.match(await page.locator('#measurement-title').textContent(),/円柱/);await page.locator('#pattern-selected-cylinder').click();await page.locator('#svg-wrap-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('svg-wrap-info').textContent.includes('円周'));}
 async function ready(){await page.waitForFunction(()=>!document.getElementById('svg-wrap-apply').disabled&&document.getElementById('canvas-host').dataset.svgWrapPreview==='true',null,{timeout:90000});}


 await load([base]);await open();
 assert.ok(await page.locator('#svg-wrap-auto-rows').isChecked());assert.ok(await page.locator('#svg-wrap-rows').isDisabled());
 const gallery=page.locator('#svg-wrap-gallery');assert.equal(await gallery.locator('button').count(),10);
 const images=new Set();for(const button of await gallery.locator('button').all())images.add(await button.locator('svg').innerHTML());assert.equal(images.size,10);
 for(const kind of ['stone','dots','honeycomb','bricks','weave','scales','grid','diamonds','zigzag','wave']){await gallery.locator('[data-pattern-kind='+kind+']').click();assert.equal(await page.locator('#svg-wrap-kind').inputValue(),kind);assert.equal(await gallery.locator('[aria-pressed=true]').getAttribute('data-pattern-kind'),kind);}
 await page.locator('#svg-wrap-size').fill('10');await page.locator('#svg-wrap-height').fill('24');await page.locator('#svg-wrap-offset').fill('8');await ready();assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'2');assert.match(await page.locator('#svg-wrap-seam-help').textContent(),/13枚 × 2段/);
 await page.locator('#svg-wrap-size').fill('20');await page.locator('#svg-wrap-height').fill('36');await page.locator('#svg-wrap-offset').fill('2');await ready();assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'2');assert.match(await page.locator('#svg-wrap-seam-help').textContent(),/6枚 × 2段/);
 await page.locator('#svg-wrap-kind').selectOption('zigzag');assert.equal(await gallery.locator('[aria-pressed=true]').getAttribute('data-pattern-kind'),'zigzag');
 // Keyboard selection uses the same action as a mouse click.
 await gallery.locator('[data-pattern-kind=wave]').focus();await page.keyboard.press('Enter');await ready();assert.equal(await page.locator('#svg-wrap-kind').inputValue(),'wave');
 await page.setViewportSize({width:1000,height:720});await page.locator('#svg-wrap-dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:'.sites-runtime/pattern-gallery-small.png'});const panel=await page.locator('#svg-wrap-dialog').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=1001&&panel.y+panel.height<=721);const cards=await gallery.locator('button').all();for(const button of cards){const b=await button.boundingBox();assert.ok(b.width>100&&b.x>=panel.x&&b.x+b.width<=panel.x+panel.width);}
 await page.setViewportSize({width:1900,height:1150});
 const jobs=await page.evaluate(()=>window.cadJobs.length);await page.locator('#svg-wrap-apply').click();await page.waitForFunction(()=>!document.getElementById('svg-wrap-dialog').open);assert.equal(await page.evaluate(()=>window.cadJobs.length),jobs);const saved=await save();assert.equal(saved.features[1].spec.generator.autoRows,true);assert.equal(saved.features[1].spec.generator.rows,2);
 await load(saved.features);await page.locator('#features .row-label').last().click();await ready();assert.ok(await page.locator('#svg-wrap-auto-rows').isChecked());assert.equal(await gallery.locator('[aria-pressed=true]').getAttribute('data-pattern-kind'),'wave');await page.locator('#svg-wrap-size').fill('30');await ready();assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'1');await page.locator('#svg-wrap-apply').click();await page.waitForFunction(()=>!document.getElementById('svg-wrap-dialog').open);const updated=await save();assert.equal(updated.features[1].id,saved.features[1].id);assert.equal(updated.features[1].spec.generator.rows,1);assert.notEqual(updated.features[1].outputs[0].brep,saved.features[1].outputs[0].brep);
 await page.locator('#undo').click();assert.equal((await save()).features[1].spec.generator.rows,2);await page.locator('#redo').click();assert.equal((await save()).features[1].spec.generator.rows,1);
 // Missing metadata in an older save must preserve the old manual geometry.
 delete saved.features[1].spec.generator.autoRows;await load(saved.features);await page.locator('#features .row-label').last().click();await ready();assert.ok(!await page.locator('#svg-wrap-auto-rows').isChecked());assert.ok(!await page.locator('#svg-wrap-rows').isDisabled());assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'2');await page.locator('#svg-wrap-size').fill('30');await ready();assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'2');await page.locator('#svg-wrap-auto-rows').check();await ready();assert.equal(await page.locator('#svg-wrap-rows').inputValue(),'1');await page.locator('#svg-wrap-auto-rows').uncheck();await page.locator('#svg-wrap-rows').fill('3');await ready();assert.match(await page.locator('#svg-wrap-seam-help').textContent(),/4枚 × 3段/);
 await page.locator('#svg-wrap-auto-rows').check();await page.locator('#svg-wrap-size').fill('0.2');await page.waitForTimeout(100);assert.ok(await page.locator('#svg-wrap-apply').isDisabled());assert.equal(await host.getAttribute('data-svg-wrap-preview'),null);assert.match(await page.locator('#svg-wrap-error').textContent(),/多すぎ|細かすぎ/);
 await page.locator('#svg-wrap-source').selectOption('svg');assert.ok(!await gallery.isVisible());assert.ok(await page.locator('#svg-wrap-file').isVisible());await page.locator('#svg-wrap-cancel').click();await page.waitForFunction(()=>!document.getElementById('canvas-host').dataset.svgWrapPreview);assert.equal((await save()).features[1].outputs[0].brep,saved.features[1].outputs[0].brep);
 assert.deepEqual(errors,[]);console.log('PASS thumbnail mouse/keyboard selection, linked size and height, manual mode, cached commit, save/reopen/edit, undo/redo, legacy saves, small viewport and invalid settings'+(process.env.FORMA_TEST_URL?' on live site':''));await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
