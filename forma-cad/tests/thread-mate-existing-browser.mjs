import {defaults} from '../src/geometry.js';
import * as THREE from 'three';
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


 async function load(features){await page.locator('#file').setInputFiles({name:'shell.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();await page.locator('[data-view=iso]').dispatchEvent('click');}
 async function screen(point){const r=await page.locator('canvas').boundingBox(),host=page.locator('#canvas-host'),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 const box={...defaults,kind:'extrusion',id:'box',name:'加工先',width:24,height:24,depth:16,x:30,y:0,z:0};
 const source=JSON.parse(await fs.readFile('.sites-runtime/thread-mate-male.forma.json','utf8'));
 await load([...source.features,box]);await page.locator('#bodies [data-body-id="base"] .row-label').click();await page.locator('#thread-mate-selected').click();
 await page.waitForFunction(()=>document.getElementById('thread-mate-source').textContent.includes('M10'));
 await page.locator('#thread-mate-destination').selectOption('existing');
 assert.equal(await page.locator('#thread-mate-body').inputValue(),'box');assert.ok(await page.locator('#thread-mate-wall-label').isHidden());
 assert.ok(await page.locator('#thread-mate-apply').isDisabled());assert.equal(await page.locator('#thread-mate-kind').textContent(),'雌ねじ（ねじ穴）');
 await page.locator('[data-view=top]').dispatchEvent('click');await page.locator('#fit').click();
 const cameraBefore=await page.locator('#canvas-host').getAttribute('data-camera-state');
 await page.locator('#thread-mate-pick').click();await page.mouse.click(...await screen([0,0,5]));assert.match(await page.locator('#thread-mate-error').textContent(),/加工先ボディ/);
 await page.mouse.click(...await screen([30,0,16]));
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('thread-mate-apply').disabled,null,{timeout:120000});}catch(e){throw Error(await page.locator('#thread-mate-error').textContent());}}
 await ready();assert.ok(JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')).every((v,i)=>Math.abs(v-JSON.parse(cameraBefore)[i])<1e-7),'existing machining keeps camera');
 await page.locator('#thread-mate-u').fill('2');await page.locator('#thread-mate-v').fill('-1');await page.locator('#thread-mate-clearance').fill('0.1');await ready();
 let analysis=JSON.parse(await page.locator('#canvas-host').getAttribute('data-thread-mate'));assert.equal(analysis.placement,'existing');assert.equal(analysis.bodyId,'box');assert.deepEqual(analysis.position.map(v=>Math.round(v*100)/100),[32,-1,16]);assert.deepEqual(analysis.direction,[0,0,-1]);assert.equal(analysis.internal,true);
 await page.locator('[data-view=iso]').dispatchEvent('click');await page.screenshot({path:'.sites-runtime/thread-mate-existing-preview.png'});
 await page.locator('#thread-mate-cancel').click();assert.deepEqual((await save()).features,[...source.features,box],'cancel preserves both bodies');
 await page.locator('#bodies [data-body-id="base"] .row-label').click();await page.locator('#thread-mate-selected').click();await page.waitForFunction(()=>document.getElementById('thread-mate-source').textContent.includes('M10'));await page.locator('#thread-mate-destination').selectOption('existing');
 await page.locator('[data-view=top]').dispatchEvent('click');await page.locator('#fit').click();await page.locator('#thread-mate-pick').click();await page.mouse.click(...await screen([30,0,16]));await ready();
 await page.locator('#thread-mate-apply').click();await page.locator('#thread-mate-dialog').waitFor({state:'hidden'});
 const made=await save(),mate=made.features.at(-1);assert.deepEqual(made.features.slice(0,-1),[...source.features,box]);assert.equal(mate.spec.destination,'existing');assert.equal(mate.outputs[0].id,'box');assert.equal(await page.locator('#body-count').textContent(),'2');
 await page.locator('#undo').click();assert.deepEqual((await save()).features,[...source.features,box]);await page.locator('#redo').click();assert.deepEqual((await save()).features,made.features);
 await load(made.features);await page.locator('#features .row-label').filter({hasText:'相手ねじ'}).click();await ready();assert.equal(await page.locator('#thread-mate-destination').inputValue(),'existing');assert.equal(await page.locator('#thread-mate-body').inputValue(),'box');
 await page.locator('#thread-mate-length').fill('6');await ready();await page.locator('#thread-mate-apply').click();await page.locator('#thread-mate-dialog').waitFor({state:'hidden'});const edited=await save();assert.equal(edited.features.at(-1).id,mate.id);assert.equal(edited.features.at(-1).spec.length,6);assert.equal(await page.locator('#body-count').textContent(),'2');
 console.log('PASS existing hole placement, offsets, preview, camera preservation, cancellation, source preservation, undo/redo and saved re-edit');
 const female=JSON.parse(await fs.readFile('.sites-runtime/thread-mate-female.forma.json','utf8'));
 await load([...female.features,box]);await page.locator('#bodies [data-body-id="base"] .row-label').click();await page.locator('#thread-mate-selected').click();await page.waitForFunction(()=>document.getElementById('thread-mate-source').textContent.includes('M10'));await page.locator('#thread-mate-destination').selectOption('existing');
 assert.equal(await page.locator('#thread-mate-kind').textContent(),'雄ねじ（面から突出）');assert.match(await page.locator('#thread-mate-source').textContent(),/左ねじ/);
 await page.locator('[data-view=top]').dispatchEvent('click');await page.locator('#fit').click();await page.locator('#thread-mate-pick').click();await page.mouse.click(...await screen([30,0,16]));await ready();
 analysis=JSON.parse(await page.locator('#canvas-host').getAttribute('data-thread-mate'));assert.equal(analysis.internal,false);assert.equal(analysis.leftHand,true);assert.deepEqual(analysis.direction,[0,0,1]);
 await page.locator('#thread-mate-apply').click();await page.locator('#thread-mate-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#body-count').textContent(),'2');
 assert.deepEqual(errors,[]);console.log('PASS left-handed male stud attached to existing body');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
