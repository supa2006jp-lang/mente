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
 const raw={...defaults,kind:'extrusion',id:'base',name:'円柱',profile:'circle',diameter:10,depth:5};
 await load([raw]);await page.locator('#selection-mode').selectOption('face');
 await page.mouse.click(...await screen([5,0,2.5]));await page.locator('#thread-selected-surface').waitFor({state:'visible'});
 assert.equal(await page.locator('#thread-selected-surface').textContent(),'この側面をねじ化');
 await page.locator('#thread-selected-surface').click();assert.equal(await page.locator('#cad-command').inputValue(),'thread');assert.equal(await page.locator('#thread-size').textContent(),'10 mm');
 await page.locator('#thread-designation').selectOption('1.5');await page.locator('#cad-apply').click();await page.waitForFunction(()=>!document.getElementById('cad-apply').disabled,null,{timeout:120000});
 assert.equal(await page.locator('#tools-dialog').isVisible(),false,await page.locator('#cad-error').textContent());
 const threaded=await save();
 async function choose(body){await page.locator('#bodies [data-body-id="'+body+'"] .row-label').click();await page.locator('#thread-mate-selected').waitFor({state:'visible'});}
 async function ready(){try{await page.waitForFunction(()=>!document.getElementById('thread-mate-apply').disabled,null,{timeout:120000});}catch(e){throw Error(await page.locator('#thread-mate-error').textContent());}}
 await choose('base');assert.equal(await page.locator('#thread-mate-selected').textContent(),'相手の雌ねじを作成');await page.locator('#thread-mate-selected').click();await ready();
 assert.match(await page.locator('#thread-mate-source').textContent(),/M10 × 1.5/);assert.equal(await page.locator('#thread-mate-kind').textContent(),'雌ねじ（円筒ナット）');
 await page.locator('#thread-mate-clearance').fill('1');assert.equal(await page.locator('#thread-mate-apply').isDisabled(),true);
 await page.locator('#thread-mate-clearance').fill('0.1');await ready();await page.screenshot({path:'.sites-runtime/thread-mate-preview.png'});
 await page.locator('#thread-mate-cancel').click();assert.deepEqual((await save()).features,threaded.features,'cancel keeps only original source');
 await choose('base');await page.locator('#thread-mate-selected').click();await ready();await page.locator('#thread-mate-clearance').fill('0.1');await ready();
 await page.locator('#thread-mate-apply').click();await page.locator('#thread-mate-dialog').waitFor({state:'hidden'});
 const made=await save(),mate=made.features.at(-1);assert.equal(mate.spec.type,'threadMate');assert.equal(mate.analysis.internal,true);assert.equal(mate.spec.clearance,.1);assert.equal(await page.locator('#body-count').textContent(),'2');assert.deepEqual(made.features.slice(0,-1),threaded.features);
 await page.locator('#undo').click();assert.deepEqual((await save()).features,threaded.features);await page.locator('#redo').click();assert.deepEqual((await save()).features,made.features);
 await load(made.features);await page.locator('#features .row-label').filter({hasText:'相手ねじ'}).click();await ready();assert.equal(await page.locator('#thread-mate-clearance').inputValue(),'0.1');
 await page.locator('#thread-mate-length').fill('6');await ready();await page.locator('#thread-mate-apply').click();await page.locator('#thread-mate-dialog').waitFor({state:'hidden'});
 const edited=await save();assert.equal(edited.features.at(-1).id,mate.id);assert.equal(edited.features.at(-1).spec.length,6);assert.equal(await page.locator('#body-count').textContent(),'2');
 console.log('PASS direct external thread action, female counterpart preview, allowance validation, cancel, creation, source preservation, undo/redo and saved re-edit');
 // Internal-wall direct action and inherited left-handed female source.
 const left=JSON.parse(await fs.readFile('.sites-runtime/thread-mate-female.forma.json','utf8'));
 await load(left.features);await choose('base');assert.equal(await page.locator('#thread-mate-selected').textContent(),'相手の雄ねじを作成');await page.locator('#thread-mate-selected').click();await ready();
 assert.match(await page.locator('#thread-mate-source').textContent(),/左ねじ/);assert.equal(await page.locator('#thread-mate-kind').textContent(),'雄ねじ（円柱）');assert.ok(await page.locator('#thread-mate-wall-label').isHidden());
 const a=JSON.parse(await page.locator('#canvas-host').getAttribute('data-thread-mate'));assert.equal(a.leftHand,true);assert.equal(a.internal,false);await page.locator('#thread-mate-cancel').click();
 await load([{...raw,mode:'thin',side:'outside',wall:2}]);await page.mouse.click(...await screen([0,4.99,2.5]));await page.locator('#thread-selected-surface').waitFor({state:'visible'});assert.equal(await page.locator('#thread-selected-surface').textContent(),'この内壁をねじ化');await page.locator('#thread-selected-surface').click();assert.match(await page.locator('#thread-face').textContent(),/穴の内壁/);await page.locator('#cad-cancel').click();
 assert.deepEqual(errors,[]);console.log('PASS direct internal wall action and left-handed male counterpart');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
