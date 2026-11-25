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
 async function undo(){await page.locator('#undo').click();await page.waitForFunction(()=>!document.getElementById('redo').disabled);}
 const control=page.locator('#taper-control'),taper=page.locator('#taper-handle'),tip=page.locator('#extrusion-tip-size'),notice=page.locator('#extrusion-notice');
 async function preview(){await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.extrusionPreviewCount==='1'&&!document.getElementById('extrusion-tip-size').textContent.includes('計算中'),null,{timeout:30000});}
 async function dragAngle(angle,fine=false){const r=await control.boundingBox(),rotation=Number(await control.getAttribute('data-rotation')),p=await taper.boundingBox(),rad=(rotation+angle)*Math.PI/180;if(fine)await page.keyboard.down('Shift');await page.mouse.move(p.x+p.width/2,p.y+p.height/2);await page.mouse.down();await page.mouse.move(r.x+70+48*Math.sin(rad),r.y+70-48*Math.cos(rad),{steps:8});await page.mouse.up();if(fine)await page.keyboard.up('Shift');await preview();}
 async function assertTip(width,height){await preview();const text=await tip.textContent();if(text.includes('CAD計算済み'))return;assert.ok(text.includes(Number(width.toFixed(2)).toString()),'width '+text);assert.ok(text.includes(Number(height.toFixed(2)).toString()),'height '+text);}
 await load([rect]);await page.locator('#viewport-depth').fill('10');await control.waitFor();await assertTip(40,30);await dragAngle(15);assert.equal(await page.locator('#taperAngle').inputValue(),'15');assert.equal(await page.locator('#viewport-taper-angle').inputValue(),'15');await assertTip(40+20*Math.tan(Math.PI/12),30+20*Math.tan(Math.PI/12));assert.equal(await panel.isVisible(),true,'angle drag never commits the extrusion');await dragAngle(15.4,true);assert.equal(await page.locator('#taperAngle').inputValue(),'15.4');assert.equal(await taper.getAttribute('aria-valuenow'),'15.4');
 async function keyAngle(key,value){
  await page.waitForFunction(()=>!document.getElementById('apply').disabled&&document.getElementById('extrusion-target-status').dataset.state==='valid');
  await taper.press(key);assert.equal(await page.locator('#taperAngle').inputValue(),value);
 }
 await keyAngle('Home','0');await keyAngle('ArrowRight','1');
 await keyAngle('Shift+ArrowLeft','0.9');await keyAngle('Home','0');await page.locator('#viewport-taper-angle').fill('15.4');await preview();await page.screenshot({path:'.sites-runtime/extrusion-feedback-controls.png'});
 await confirm.click();await settled();assert.equal(await notice.count(),0);assert.equal(await control.isVisible(),false);
 let data=await save();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).depth,10);assert.equal(data.features.at(-1).taperAngle,15.4);
 await undo();data=await save();assert.equal(data.features.length,1);assert.equal(await page.locator('#body-count').textContent(),'0');
 await page.locator('#redo').click();await page.waitForFunction(()=>document.getElementById('redo').disabled);
 data=await save();assert.equal(data.features.length,2);assert.equal(data.features.at(-1).taperAngle,15.4);
 await page.locator('#features .row-label').last().click();await panel.waitFor();await page.locator('#viewport-taper-angle').fill('-5');
 await preview();await confirm.click();await settled();assert.equal(await notice.count(),0);assert.equal((await save()).features.at(-1).taperAngle,-5);
 await undo();assert.equal((await save()).features.at(-1).taperAngle,15.4,'undo restores previous edited parameters');
 const circle={...rect,id:'circle',name:'円',profile:'circle',diameter:30};await load([circle]);await page.locator('#viewport-depth').fill('-10');await page.locator('#viewport-taper-angle').fill('-5');await preview();assert.match(await tip.textContent(),/外径 28.25 mm|CAD計算済み/);await page.locator('[data-view=right]').dispatchEvent('keydown',{key:'Enter'});await preview();assert.match(await tip.textContent(),/外径 28.25 mm|CAD計算済み/);await page.setViewportSize({width:1000,height:760});await page.waitForTimeout(100);const cr=await control.boundingBox(),vr=await page.locator('.viewport').boundingBox();assert.ok(cr.x>=vr.x&&cr.y>=vr.y&&cr.x+cr.width<=vr.x+vr.width+1&&cr.y+cr.height<=vr.y+vr.height+1);await page.locator('#viewport-extrude-cancel').click();assert.equal(await control.isVisible(),false);await page.setViewportSize({width:1600,height:1000});
 const base={...defaults,id:'b',name:'本体',kind:'extrusion',width:80,height:60,depth:20},cut={...defaults,id:'c',name:'円の切り取り',kind:'extrusion',profile:'circle',diameter:20,z:20,depth:-10,operation:'cut',target:'b'};
 await load([base,cut],true);await page.locator('#viewport-depth').fill('-5');await confirm.click();await settled();assert.equal(await notice.count(),0);
 const edited=(await save()).features.at(-1);assert.equal(edited.operation,'cut');assert.equal(edited.depth,-5);
 await undo();assert.equal((await save()).features.at(-1).depth,-10);assert.deepEqual(errors,[]);await context.close();
 console.log('PASS taper controls, preview feedback, confirmation without a panel, and toolbar undo/redo'+(process.env.FORMA_TEST_URL?' on live site':''));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
