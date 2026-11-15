import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {setOC} from 'replicad';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep))throw Error('Outside the web root');
  const body=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1800,height:1100}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const host=page.locator('#canvas-host'),canvas=host.locator('canvas');
 const commands=page.locator('#selection-commands');
 const action=id=>commands.locator('[data-selection-action="'+id+'"]');
 const more=commands.locator('details');
 async function openMore(){if(!await more.evaluate(element=>element.open))await more.locator('summary').click();}
 const assembly=page.locator('#assembly-dialog');
 const field=id=>assembly.locator('[data-id="'+id+'"]');
 const boxes=[
  {...defaults,id:'a',kind:'extrusion',name:'左の箱',x:-24,width:20,height:20,depth:10},
  {...defaults,id:'b',kind:'extrusion',name:'右の箱',x:24,width:20,height:20,depth:10},
 ];
 async function load(features){
  await page.locator('#file').setInputFiles({name:'selection.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forma-cad',version:1,features}))});
  await page.locator('#project-preview-open').click();
  await page.locator('#project-load-preview').waitFor({state:'hidden'});
  await page.locator('[data-view=top]').dispatchEvent('keydown',{key:'Enter'});
  await page.locator('#fit').click();
  await page.waitForTimeout(250);
 }
 async function screenPoint(point){
  const rect=await canvas.boundingBox(),state=JSON.parse(await host.getAttribute('data-camera-state'));
  const clip=JSON.parse(await host.getAttribute('data-camera-clip'));
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const projected=new THREE.Vector3(...point).project(camera);
  return {x:rect.x+(projected.x+1)*rect.width/2,y:rect.y+(1-projected.y)*rect.height/2};
 }
 async function pick(point,{add=false}={}){
  const {x,y}=await screenPoint(point);
  if(add)await page.keyboard.down('Control');
  try{await page.mouse.click(x,y);}
  finally{if(add)await page.keyboard.up('Control');}
 }
 await load(boxes);
 await commands.waitFor({state:'hidden'});
 await page.locator('#selection-mode').selectOption('face');
 const left=[-22,2,10],right=[26,2,10];
 const view=await canvas.boundingBox(),beforePan=await screenPoint(left);
 const drag={x:view.x+view.width*.7,y:view.y+view.height*.3};
 await page.mouse.move(drag.x,drag.y);await page.mouse.down({button:'middle'});
 await page.mouse.move(drag.x+view.x+155-beforePan.x,drag.y+view.y+view.height*.72-beforePan.y,{steps:8});
 await page.mouse.up({button:'middle'});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await pick(left);
 await action('extrude').waitFor();
 const selectedPoint=await screenPoint(left),measurement=page.locator('#measurement');
 await page.waitForFunction(()=>!!document.getElementById('measurement').style.translate);
 const menuBounds=await measurement.boundingBox();
 assert.ok(selectedPoint.x<menuBounds.x||selectedPoint.x>menuBounds.x+menuBounds.width||
  selectedPoint.y<menuBounds.y||selectedPoint.y>menuBounds.y+menuBounds.height);
 const arrow=await page.locator('#face-extrude-shortcut').boundingBox();
 assert.ok(arrow&&(
  arrow.x>=menuBounds.x+menuBounds.width||arrow.x+arrow.width<=menuBounds.x||
  arrow.y>=menuBounds.y+menuBounds.height||arrow.y+arrow.height<=menuBounds.y
 ));
 await page.locator('#fit').click();
 assert.ok(await commands.getByRole('button',{name:'この面にスケッチ'}).isVisible());
 assert.equal(await action('hole').isVisible(),false);
 assert.equal(await page.locator('#sketch-on-face-grid').count(),1);
 await action('extrude').click();
 await page.locator('#extrude-distance').waitFor();
 await page.keyboard.press('Escape');
 await pick(left);
 await openMore();
 assert.match(await commands.textContent(),/別のボディの平面をもう1つ/);
 await action('hole').click();
 await page.locator('#hole-panel').waitFor();
 assert.ok(await page.locator('#hole-apply').isDisabled());
 await commands.waitFor({state:'hidden'});
 await page.keyboard.press('Escape');

 await pick(left);await openMore();await action('boss').click();
 await page.locator('#boss-joint-dialog').waitFor();
 assert.equal(await page.locator('#boss-joint-target').inputValue(),'a');
 await page.locator('#boss-joint-cancel').click();

 await pick(left);await openMore();await action('align').click();
 await assembly.waitFor();
 assert.match(await field('source-name').textContent(),/左の箱/);
 assert.equal(await field('destination').getAttribute('aria-pressed'),'true');
 assert.match(await field('status').textContent(),/相手の面をクリック/);
 await commands.waitFor({state:'hidden'});
 await field('cancel').click();

 await pick(left);await pick(right,{add:true});
 await openMore();
 await commands.getByText('最初に選んだ面のボディを動かします。').waitFor();
 await action('hole').waitFor({state:'hidden'});
 await action('align').click();
 await page.waitForFunction(()=>!!document.querySelector('#canvas-host').dataset.assemblyPreview);
 const preview=JSON.parse(await host.getAttribute('data-assembly-preview'));
 assert.equal(preview.source,'a');assert.equal(preview.destination,'b');
 await field('cancel').click();

 await page.locator('#selection-mode').selectOption('edge');
 await pick([-24,10,10]);
 await action('fillet').waitFor();
 assert.ok(await action('chamfer').isVisible());
 await action('fillet').click();
 await page.locator('#tools-dialog').waitFor();
 assert.equal(await page.locator('#cad-command').inputValue(),'fillet');
 await page.locator('#cad-cancel').click();
 await page.keyboard.press('Escape');
 await commands.waitFor({state:'hidden'});

 setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const box=boxes[0];
 const edges=[-34,-14].flatMap(x=>[-10,10].map(y=>({bodyId:box.id,point:[x,y,5]})));
 const fillet={type:'fillet',id:'round',target:box.id,radius:2,edges};
 await load([box,{kind:'cadop',id:fillet.id,name:'フィレット',spec:fillet,...runOperation([box],fillet)}]);
 await page.locator('#selection-mode').selectOption('face');
 await pick(left);
 await openMore();
 await action('shell').click();
 await page.locator('#tools-dialog').waitFor();
 assert.equal(await page.locator('#cad-command').inputValue(),'shell');
 assert.equal(await page.locator('#cad-target').inputValue(),box.id);
 await page.locator('#cad-thickness').fill('1');
 await page.locator('#cad-apply').click();
 await page.locator('#features').getByText('シェル · 壁 1 mm · クリックで再編集',{exact:true}).waitFor();
 assert.equal(await page.locator('#body-count').textContent(),'1');
 assert.deepEqual(errors,[]);
 console.log('PASS face and edge shortcuts, one- and two-face alignment, and one-face shell on a rounded box');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
