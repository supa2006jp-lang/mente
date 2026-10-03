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
 const context=await browser.newContext({viewport:{width:1700,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.defaultValue()));
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();
 const host=page.locator('#canvas-host'),all='__all_bodies__';
 const far={...defaults,id:'far',name:'離れたボディ',kind:'extrusion',width:20,height:20,depth:10,x:70};
 const a={...defaults,id:'a',name:'下のボディ',kind:'extrusion',width:24,height:24,depth:10};
 const b={...a,id:'b',name:'上のボディ',z:15};
 const sketch={...defaults,id:'sketch',name:'円の輪郭',kind:'sketch',profile:'circle',diameter:8,z:30,groupId:'g',groupNumber:1,groupHidden:false};
 const features=[far,a,b,sketch];
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'all-targets.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}
 async function begin(data,point=[0,0,30]){await load(data);await page.mouse.click(...await screen(point));await page.locator('#solid-tool').click();await page.locator('#extrude-distance').waitFor({state:'visible'});assert.equal(await page.locator('#target').inputValue(),all,'new extrusion defaults to all');assert.equal(await page.locator('#viewport-target').inputValue(),all);assert.equal(await page.locator('#viewport-target option').first().textContent(),'全て');}
 async function apply(count){await page.locator('#extrude-distance button[type=submit]').click();await page.waitForFunction(n=>Number(document.getElementById('feature-count').textContent)===n&&document.getElementById('extrude-distance').hidden,count);}
 await begin(features);await page.locator('#viewport-depth').fill('-35');await page.waitForFunction(()=>document.getElementById('operation').value==='cut');assert.equal(await page.locator('#target').inputValue(),all,'auto cut keeps all targets');assert.ok(await page.locator('#viewport-cut-all-bodies').isChecked());await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionRemovedCount==='2');await page.screenshot({path:'.sites-runtime/extrusion-all-targets.png'});await apply(5);
 const cutData=await save(),cut=cutData.features.at(-1);assert.equal(cut.targetAllBodies,true);assert.equal(cut.cutAllBodies,true);assert.deepEqual(cut.cadResult.outputs.map(o=>o.id),['a','b']);assert.deepEqual(cutData.features.slice(0,4),features);assert.equal(await page.locator('#body-count').textContent(),'3');
 await page.locator('#undo').click();assert.equal(await page.locator('#feature-count').textContent(),'4');await page.locator('#redo').click();assert.equal(await page.locator('#feature-count').textContent(),'5');await page.locator('#features .row-label').last().click();
 // Open from history when the completion notice has been cleared by undo/redo.
 if(await page.locator('#extrude-distance').isHidden())await page.locator('#features .row-label').last().click();await page.locator('#extrude-distance').waitFor({state:'visible'});assert.equal(await page.locator('#target').inputValue(),all);await page.locator('#viewport-depth').fill('-20');await apply(5);const edited=await save();assert.equal(edited.features.at(-1).targetAllBodies,true);assert.deepEqual(edited.features.at(-1).cadResult.outputs.map(o=>o.id),['b']);
 await load(cutData.features);await page.locator('#features .row-label').last().click();assert.equal(await page.locator('#target').inputValue(),all,'all target survives file load and history editing');await page.keyboard.press('Escape');
 await begin(features);await page.locator('#viewport-depth').fill('-35');await page.locator('#viewport-operation').selectOption('cut');await page.locator('#viewport-target').selectOption('a');assert.equal(await page.locator('#target').inputValue(),'a');assert.equal(await page.locator('#viewport-cut-all-bodies').isChecked(),false);await page.locator('#target').selectOption('b');assert.equal(await page.locator('#viewport-target').inputValue(),'b');await page.locator('#viewport-target').selectOption('a');await apply(5);const single=await save();assert.equal(single.features.at(-1).targetAllBodies,false);assert.equal(single.features.at(-1).cutAllBodies,false);assert.deepEqual(single.features.at(-1).cadResult.outputs.map(o=>o.id),['a']);
 const legacy=structuredClone(cutData);delete legacy.features.at(-1).targetAllBodies;await load(legacy.features);await page.locator('#features .row-label').last().click();assert.equal(await page.locator('#target').inputValue(),all,'legacy all-body cut maps to all option');await page.keyboard.press('Escape');
 await begin([far,a,b],[0,0,25]);assert.equal(await page.locator('#viewport-operation').inputValue(),'join');await page.locator('#viewport-depth').fill('5');await apply(4);const faceJoin=await save();assert.equal(faceJoin.features.at(-1).targetAllBodies,true);assert.deepEqual(faceJoin.features.at(-1).cadResult.outputs.map(o=>o.id),['b']);assert.deepEqual(faceJoin.features.at(-1).cadResult.remove,[],'extrusion from face keeps its source body and other bodies');
 const left={...a,id:'left',name:'左ボディ',x:-15,width:10,height:20},right={...left,id:'right',name:'右ボディ',x:15},bridge={...sketch,id:'bridge',profile:'rect',width:24,height:8,z:5};await begin([far,left,right,bridge],[0,0,5]);await page.locator('#viewport-depth').fill('5');await page.locator('#viewport-operation').selectOption('join');assert.equal(await page.locator('#viewport-target').inputValue(),all);await apply(5);const joined=await save();assert.equal(joined.features.at(-1).targetAllBodies,true);assert.equal(joined.features.at(-1).operation,'join');assert.deepEqual(joined.features.at(-1).cadResult.outputs.map(o=>o.id),['left']);assert.deepEqual(joined.features.at(-1).cadResult.remove,['right']);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual(joined.features.slice(0,4),[far,left,right,bridge]);
 // No existing bodies: the all entry must not enable cut/join.
 await begin([sketch]);assert.ok(await page.locator('#viewport-operation option[value=cut]').evaluate(o=>o.disabled));assert.ok(await page.locator('#viewport-operation option[value=join]').evaluate(o=>o.disabled));assert.ok(await page.locator('#viewport-target option').first().evaluate(o=>o.disabled));await page.locator('#viewport-depth').fill('5');await apply(2);assert.equal(await page.locator('#body-count').textContent(),'1');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS all-target defaults in both selectors, auto cut, multi-body removal preview, cut/join processing, unaffected far body, concrete targets, undo/redo, edit/reload, legacy all-cut and empty-model operation availability'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
