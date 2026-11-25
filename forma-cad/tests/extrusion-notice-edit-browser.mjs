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
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('#canvas-host canvas').waitFor();await page.waitForFunction(()=>typeof document.getElementById('file')?.onchange==='function');

 const confirm=page.locator('#extrude-distance button[type=submit]'),panel=page.locator('#extrude-distance'),rect={...defaults,id:'r',name:'四角',kind:'sketch',width:40,height:30,groupId:'g',groupNumber:1};
 async function load(features,edit=false){await page.locator('#file').setInputFiles({name:'arrow.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('#fit').click();if(edit){await page.locator('#features .row-label').last().click();}else{await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.waitForTimeout(120);const r=await page.locator('#canvas-host canvas').boundingBox(),s=JSON.parse(await page.locator('#canvas-host').getAttribute('data-camera-state')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,.1,100000);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const q=new THREE.Vector3(8,0,0).project(c);await page.mouse.click(r.x+(q.x+1)*r.width/2,r.y+(1-q.y)*r.height/2);await page.locator('#solid-tool').click();}await panel.waitFor();await page.locator('#taperReference').selectOption('normal');await page.locator('[data-view=iso]').click();await page.waitForTimeout(80);}
 async function save(){const event=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'));}
 async function settled(){await panel.waitFor({state:'hidden',timeout:30000});}

 const notice=page.locator('#extrusion-notice'),depth=page.locator('#depth'),angle=page.locator('#viewport-taper-angle');
 async function editHistory(id){
  await page.locator('[data-history-feature="'+id+'"] .row-label').click();
  await panel.waitFor();
  assert.equal(await notice.count(),0);
 }
 async function preview(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1',null,{timeout:30000});}
 await load([rect]);await page.locator('#viewport-depth').fill('5');await confirm.click();await settled();
 assert.equal(await notice.count(),0);
 const initial=await save(),id=initial.features.at(-1).id;
 await editHistory(id);assert.equal(await depth.inputValue(),'5');assert.deepEqual((await save()).features,initial.features);
 await depth.fill('7');await page.locator('#apply').click();await settled();
 let data=await save();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).id,id);assert.equal(data.features.at(-1).depth,7);
 await editHistory(id);assert.equal(await depth.inputValue(),'7');await page.locator('#viewport-depth').fill('9');
 await page.locator('#viewport-extrude-cancel').click();await settled();assert.equal((await save()).features.at(-1).depth,7);
 const circle={...rect,id:'circle',name:'円',profile:'circle',diameter:30};
 await load([circle]);await page.locator('#viewport-depth').fill('10');await angle.fill('10');await preview();await confirm.click();await settled();
 const tapered=await save(),taperId=tapered.features.at(-1).id;
 await editHistory(taperId);assert.equal(await depth.inputValue(),'10');assert.equal(await angle.inputValue(),'10');
 await page.locator('#viewport-depth').fill('12');await angle.fill('-5');await preview();await confirm.click();await settled();
 data=await save();assert.equal(data.features.at(-1).id,taperId);assert.equal(data.features.at(-1).depth,12);assert.equal(data.features.at(-1).taperAngle,-5);assert.ok(data.features.at(-1).cadResult.outputs[0].brep);
 await page.locator('#undo').click();await page.waitForFunction(()=>!document.getElementById('redo').disabled);
 assert.equal((await save()).features.at(-1).depth,10);
 const base={...defaults,id:'b',name:'本体',kind:'extrusion',width:80,height:60,depth:20},cut={...defaults,id:'c',name:'円の切り取り',kind:'extrusion',profile:'circle',diameter:20,z:20,depth:-10,operation:'cut',target:'b'};
 await load([base,cut],true);await page.locator('#viewport-depth').fill('-5');await confirm.click();await settled();
 await editHistory('c');assert.equal(await page.locator('#operation').inputValue(),'cut');assert.equal(await page.locator('#target').inputValue(),'b');assert.equal(await depth.inputValue(),'-5');
 await page.locator('#viewport-depth').fill('-7');await confirm.click();await settled();
 data=await save();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).id,'c');assert.equal(data.features.at(-1).depth,-7);assert.equal(data.features[0].depth,20);
 await editHistory('b');assert.equal(await depth.inputValue(),'20');await page.locator('#viewport-extrude-cancel').click();
 assert.deepEqual(errors,[]);await context.close();console.log('PASS extrusion history edits, distance/taper/cut updates, cancel and undo without a completion panel'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
