import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
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
 await page.addInitScript(()=>{window.cadJobs=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(payload,...args){if(payload.spec){window.cadJobs.push(payload.spec.type);window.latestSpec=payload.spec;}return post.call(this,payload,...args);};});
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){const op=m.spec?.type==='preview'?m.spec.operation:m.spec;if(window.forceCadError&&['fillet','shell'].includes(op?.type)){const error=window.forceCadError;setTimeout(()=>this.onmessage?.({data:{id:m.id,error}}),5);return;}return post.call(this,m,...args);};});
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+prefix);await page.locator('canvas').waitFor();





 const host=page.locator('#canvas-host'),canvas=page.locator('canvas'),picker=page.locator('#selection-candidates');
 const back={...defaults,id:'back',name:'奥の本体',kind:'extrusion',width:40,height:30,depth:10,z:0},front={...back,id:'front',name:'手前の本体',z:20};
 async function load(features){await page.keyboard.press('Escape');await page.locator('#file').setInputFiles({name:'overlap.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});await page.locator('#project-preview-open').click();await page.waitForFunction(()=>!document.getElementById('project-load-preview').open);await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});await page.locator('#fit').click();await page.waitForTimeout(100);}
 async function screen(point){const r=await canvas.boundingBox(),s=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip')),c=new THREE.OrthographicCamera(-100*r.width/r.height,100*r.width/r.height,100,-100,...clip);c.position.fromArray(s);c.quaternion.fromArray(s,3);c.zoom=s[7];c.updateProjectionMatrix();c.updateMatrixWorld(true);const p=new THREE.Vector3(...point).project(c);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2];}
 async function save(){const promise=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(await fs.readFile(await(await promise).path(),'utf8'));}

 const persistent=page.locator('#selected-point-marker');
 async function selectPoint(kind,body='back',point=kind==='faceCenter'?[8,6,30]:[19.8,5,30]){
  await page.locator('#selection-mode').selectOption(kind==='faceCenter'?'face':'auto');await page.mouse.click(...await screen(point));await picker.waitFor();
  const choice=picker.locator('[data-kind='+kind+'][data-body-id='+body+']').first();await choice.click();await persistent.waitFor();await picker.locator('[data-close]').click();await page.mouse.move(30,30);
  await page.waitForTimeout(100);assert.equal(await persistent.isVisible(),true,'selected point persists after cursor and candidates leave');
  return JSON.parse(await host.getAttribute('data-selected-point'));
 }
 async function positioned(){const r=await persistent.boundingBox(),p=JSON.parse(await host.getAttribute('data-selected-point')).point,screenPoint=await screen(p);assert.ok(Math.hypot(r.x+r.width/2-screenPoint[0],r.y+r.height/2-screenPoint[1])<2,'persistent point follows camera and canvas resizing');}
 function bounds(output){const values=[[],[],[]];for(let i=0;i<output.vertices.length;i++)values[i%3].push(output.vertices[i]);return values.map(v=>[Math.min(...v),Math.max(...v)]);}
 function near(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>Array.isArray(v)?near(v,expected[i]):assert.ok(Math.abs(v-expected[i])<.01,actual+' != '+expected));}
 await load([back,front]);const original=(await save()).features;
 await page.locator('#selection-mode').selectOption('face');await page.mouse.click(...await screen([8,6,30]));await picker.waitFor();const rear=picker.locator('[data-kind=faceCenter][data-body-id=back]').first();assert.match(await rear.textContent(),/上面.*奥の本体.*奥.*X 0.00.*Z 10.00/);assert.match(await picker.locator('[data-kind=face][data-body-id=back]').last().textContent(),/底面/);await page.keyboard.press('Escape');
 const center=await selectPoint('faceCenter');assert.deepEqual(center.point,[0,0,10]);assert.equal(center.bodyId,'back');await positioned();await page.locator('[data-view=iso]').click();await page.waitForTimeout(100);await positioned();await page.setViewportSize({width:1650,height:1000});await page.waitForTimeout(150);await positioned();await page.screenshot({path:'.sites-runtime/selected-point-persistent.png'});
 // Selecting a different entity and Esc both clear the persistent point.
 await page.locator('#selection-mode').selectOption('body');await persistent.waitFor({state:'hidden'});await page.setViewportSize({width:1900,height:1150});await load([back,front]);await selectPoint('faceCenter');await page.keyboard.press('Escape');await persistent.waitFor({state:'hidden'});assert.equal(await host.getAttribute('data-selected-point'),null);
 await selectPoint('faceCenter');await page.locator('#point-to-origin').click();await page.locator('#move-panel').waitFor();const originPreview=JSON.parse(await host.getAttribute('data-move-preview'));assert.deepEqual(originPreview.pivot,[0,0,10]);assert.deepEqual(originPreview.position,[0,0,0]);assert.equal(Number(await page.locator('#move-z').inputValue()),-10);assert.equal(await page.locator('#move-apply').isEnabled(),true,'selected body is ready without repicking');await page.locator('#move-cancel').click();assert.deepEqual((await save()).features,original,'cancel has no geometry effect');
 await selectPoint('faceCenter');await page.locator('#point-to-origin').click();await page.locator('#move-apply').click();await page.waitForFunction(()=>document.getElementById('move-panel').hidden,null,{timeout:90000});let saved=await save(),op=saved.features.at(-1);assert.equal(op.spec.target,'back');assert.deepEqual(op.spec.pivot,[0,0,10]);assert.equal(op.spec.z,-10);near(bounds(op.outputs.find(o=>o.id==='back')),[[-20,20],[-15,15],[-10,0]]);await persistent.waitFor({state:'hidden'});await page.locator('#undo').click();assert.deepEqual((await save()).features,original);
 // A rear edge midpoint is an off-center pivot. The real solid must orbit that point.
 const mid=await selectPoint('midpoint');assert.deepEqual(mid.point,[20,0,10]);assert.equal(await persistent.isVisible(),true);await page.locator('#point-rotate').click();await page.locator('#move-panel').waitFor();assert.equal(await page.locator('[data-mode=rotate]').getAttribute('aria-pressed'),'true');assert.deepEqual(JSON.parse(await host.getAttribute('data-move-preview')).pivot,[20,0,10]);await page.locator('#move-plus90').click();await page.screenshot({path:'.sites-runtime/selected-point-rotation.png'});await page.locator('#move-apply').click();await page.waitForFunction(()=>document.getElementById('move-panel').hidden,null,{timeout:90000});saved=await save();op=saved.features.at(-1);assert.equal(op.spec.target,'back');assert.deepEqual(op.spec.pivot,[20,0,10]);assert.deepEqual(op.spec.rotation,[0,0,90]);near(bounds(op.outputs.find(o=>o.id==='back')),[[5,35],[-40,0],[0,10]]);const rebuilt=rebuild(saved.features),frontGeometry=rebuilt.get('front').geometry;frontGeometry.computeBoundingBox();near([frontGeometry.boundingBox.min.toArray(),frontGeometry.boundingBox.max.toArray()],[[-20,-15,20],[20,15,30]]);for(const body of rebuilt.values())body.geometry.dispose();await page.locator('#undo').click();assert.deepEqual((await save()).features,original);
 // The same midpoint can be translated to the global origin, independent of the grid plane.
 await selectPoint('midpoint');await page.locator('#point-to-origin').click();assert.equal(Number(await page.locator('#move-x').inputValue()),-20);assert.equal(Number(await page.locator('#move-z').inputValue()),-10);await page.locator('#move-apply').click();await page.waitForFunction(()=>document.getElementById('move-panel').hidden,null,{timeout:90000});op=(await save()).features.at(-1);near(bounds(op.outputs.find(o=>o.id==='back')),[[-40,0],[-15,15],[-10,0]]);await page.locator('#undo').click();assert.deepEqual((await save()).features,original);
 // Plain move retains its original behavior after point-driven actions.
 await page.locator('#move-tool').click();await page.mouse.click(...await screen([8,6,30]));await page.waitForFunction(()=>document.getElementById('canvas-host').dataset.movePreview);assert.deepEqual(JSON.parse(await host.getAttribute('data-move-preview')).pivot,[0,0,25]);await page.locator('#move-cancel').click();assert.deepEqual(errors,[]);
 console.log('PASS oriented labels and coordinates; persistent hidden-face center and midpoint through camera/resize; clearing, cancel, actual point-to-origin, off-center rotation, untouched other body, undo and ordinary move');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
