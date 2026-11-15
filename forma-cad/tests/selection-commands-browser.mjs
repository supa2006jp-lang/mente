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
 const navigation=page.locator('.navigation'),navigationToggle=page.locator('#viewport-navigation-toggle');
 const gridToggle=page.locator('#grid-toggle'),gridState=await gridToggle.getAttribute('aria-pressed');
 const viewHelp=page.locator('.view-help');
 assert.ok(await viewHelp.isVisible());
 const navigationBounds=await navigation.boundingBox();
 await navigationToggle.click();
 assert.equal(await navigationToggle.getAttribute('aria-expanded'),'false');
 assert.equal(await gridToggle.isVisible(),false);
 assert.equal(await page.locator('#fit').isVisible(),false);
 assert.equal(await viewHelp.isVisible(),false);
 assert.ok((await navigation.boundingBox()).width<navigationBounds.width/2);
 await navigationToggle.click();
 assert.equal(await navigationToggle.getAttribute('aria-expanded'),'true');
 assert.ok(await gridToggle.isVisible());
 assert.ok(await viewHelp.isVisible());
 assert.equal(await gridToggle.getAttribute('aria-pressed'),gridState);
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
 const faceBody=measurement.locator('#measurement-face-body');
 await faceBody.filter({hasText:'所属ボディ　左の箱（1）'}).waitFor();
 await measurement.locator('#measurement-length').filter({hasText:'20 mm × 20 mm'}).waitFor();
 await page.locator('#face-extrude-shortcut').waitFor();
 const menuBounds=await measurement.boundingBox();
 assert.ok(selectedPoint.x<menuBounds.x||selectedPoint.x>menuBounds.x+menuBounds.width||
  selectedPoint.y<menuBounds.y||selectedPoint.y>menuBounds.y+menuBounds.height);
 const arrow=await page.locator('#face-extrude-shortcut').boundingBox();
 assert.ok(arrow&&(
  arrow.x>=menuBounds.x+menuBounds.width||arrow.x+arrow.width<=menuBounds.x||
  arrow.y>=menuBounds.y+menuBounds.height||arrow.y+arrow.height<=menuBounds.y
 ));
 const handle=await page.locator('#measurement-drag-handle').boundingBox();
 await page.mouse.move(handle.x+12,handle.y+handle.height/2);
 await page.mouse.down();
 await page.mouse.move(view.x+view.width-30,view.y-12,{steps:10});
 await page.mouse.up();
 const manualBounds=await measurement.boundingBox();
 assert.equal(await measurement.getAttribute('data-panel-position'),'manual');
 assert.ok(Math.hypot(manualBounds.x-menuBounds.x,manualBounds.y-menuBounds.y)>30);
 assert.ok(manualBounds.x>=view.x-.5&&manualBounds.y>=view.y-.5);
 assert.ok(manualBounds.x+manualBounds.width<=view.x+view.width+.5&&manualBounds.y+manualBounds.height<=view.y+view.height+.5);
 assert.equal(await host.getAttribute('data-selected-face-count'),'1');
 await page.locator('#fit').click();
 const afterFit=await measurement.boundingBox();
 assert.ok(Math.abs(afterFit.x-manualBounds.x)<1&&Math.abs(afterFit.y-manualBounds.y)<1);
 await page.locator('#measurement-reset-position').click();
 assert.equal(await measurement.getAttribute('data-panel-position'),null);
 const menuToggle=measurement.locator('#measurement-toggle');
 await menuToggle.click();
 assert.ok(await faceBody.isVisible());
 await action('extrude').waitFor({state:'hidden'});
 await menuToggle.click();
 assert.ok(await commands.getByRole('button',{name:'この面にスケッチ'}).isVisible());
 assert.ok(await action('hole').isVisible());
 await more.locator('summary').click();
 assert.equal(await action('hole').isVisible(),false);
 assert.equal(await page.locator('#sketch-on-face-grid').count(),1);
 await action('extrude').click();
 await page.locator('#extrude-distance').waitFor();
 await commands.waitFor({state:'hidden'});
 await page.keyboard.press('Escape');
 await pick(left);
 await action('hole').waitFor();
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

 await pick(right);
 await faceBody.filter({hasText:'所属ボディ　右の箱（2）'}).waitFor();
 await pick(left);await pick(right,{add:true});
 await openMore();
 await commands.getByText('最初に選んだ面のボディを動かします。').waitFor();
 await faceBody.waitFor({state:'hidden'});
 await action('hole').waitFor({state:'hidden'});
 await action('align').click();
 await page.waitForFunction(()=>!!document.querySelector('#canvas-host').dataset.assemblyPreview);
 const preview=JSON.parse(await host.getAttribute('data-assembly-preview'));
 assert.equal(preview.source,'a');assert.equal(preview.destination,'b');
 await field('cancel').click();

 await page.locator('#selection-mode').selectOption('edge');
 await pick([-24,10,10]);
 await action('fillet').waitFor();
 await faceBody.waitFor({state:'hidden'});
 assert.ok(await action('chamfer').isVisible());
 await action('fillet').click();
 await page.locator('#tools-dialog').waitFor();
 assert.equal(await page.locator('#cad-command').inputValue(),'fillet');
 await page.locator('#cad-cancel').click();
 await page.keyboard.press('Escape');
 await commands.waitFor({state:'hidden'});
 await page.locator('#bodies [data-body-id="a"] .row-label').click();
 await faceBody.waitFor({state:'hidden'});

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
 await load([{...defaults,id:'round-cap',kind:'extrusion',name:'円柱',profile:'circle',diameter:45,depth:10}]);
 await page.locator('#selection-mode').selectOption('face');
 await pick([0,0,10]);
 await measurement.locator('#measurement-length').filter({hasText:'直径 45 mm'}).waitFor();
 await faceBody.filter({hasText:'所属ボディ　円柱（1）'}).waitFor();
 const renameButton=page.locator('#bodies [data-body-id="round-cap"] .body-rename-button');
 await renameButton.click();
 const rename=page.locator('#body-rename-dialog');
 await rename.locator('input').fill('支柱 A');
 await rename.getByRole('button',{name:'変更する'}).click();
 const bodyLabel=page.locator('#bodies [data-body-id="round-cap"] .row-label');
 await bodyLabel.filter({hasText:'支柱 A'}).waitFor();
 await faceBody.filter({hasText:'所属ボディ　支柱 A'}).waitFor();
 await page.locator('#undo').click();
 await bodyLabel.filter({hasText:'円柱（1）'}).waitFor();
 await page.locator('#redo').click();
 await bodyLabel.filter({hasText:'支柱 A'}).waitFor();
 await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 const download=page.waitForEvent('download');
 page.once('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.locator('#save').click();
 const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
 assert.equal(saved.features[0].bodyNames['round-cap'],'支柱 A');
 await load(saved.features);
 await bodyLabel.filter({hasText:'支柱 A'}).waitFor();

 const outline=(radius,sign=1)=>Array.from({length:128},(_,i)=>{
  const angle=sign*i*Math.PI/64;
  return [radius*Math.cos(angle),radius*Math.sin(angle)];
 });
 const withOpening=(id,outer,...holes)=>({...defaults,id,kind:'extrusion',name:id,profile:'region',depth:10,
  region:{plane:'XY',offset:0,outer,holes}});
 const length=measurement.locator('#measurement-length'),details=length.locator('.measurement-face-detail');
 await load([withOpening('リング',outline(25),outline(15,-1))]);
 await page.locator('#selection-mode').selectOption('face');
 await pick([20,0,10]);
 await length.filter({hasText:'外径 50 mm'}).waitFor();
 const openingRow=length.locator('.measurement-opening-row');
 assert.deepEqual(await length.locator('.measurement-opening-size').allTextContents(),['内径 30 mm']);
 assert.deepEqual(await details.last().textContent(),'縁の厚さ 10 mm');
 await openingRow.hover();
 await length.locator('.opening-highlighted').waitFor();
 await page.locator('#body-count').hover();
 await length.locator('.opening-highlighted').waitFor({state:'detached'});
 await openingRow.getByRole('button').focus();
 await length.locator('.opening-highlighted').waitFor();
 await page.keyboard.press('Enter');
 await page.locator('#sketches [data-sketch-group][data-remaining-region-count="1"]').waitFor();
 assert.equal(await page.locator('#body-count').textContent(),'1');
 const openingDownload=page.waitForEvent('download');
 page.once('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.locator('#save').click();
 const openingFile=JSON.parse(await fs.readFile(await (await openingDownload).path(),'utf8'));
 const circle=openingFile.features.find(feature=>feature.kind==='sketch');
 assert.equal(circle.profile,'circle');
 assert.ok(Math.abs(circle.diameter-30)<.001&&Math.abs(circle.z-10)<.001);
 await page.locator('#undo').click();
 await page.locator('#sketches [data-sketch-group]').waitFor({state:'detached'});
 await load([withOpening('長方形の枠',[[-50,-25],[50,-25],[50,25],[-50,25]],[[-40,-15],[-40,15],[40,15],[40,-15]])]);
 await page.locator('#selection-mode').selectOption('face');
 await pick([44,4,10]);
 await length.filter({hasText:'外寸 50 mm × 100 mm'}).waitFor();
 assert.deepEqual(await length.locator('.measurement-opening-size').allTextContents(),['開口 30 mm × 80 mm']);
 await load([withOpening('開口2箇所',[[-45,-28],[45,-28],[45,28],[-45,28]],
  outline(8,-1).map(([x,y])=>[x-20,y]),[[12,-7],[12,7],[28,7],[28,-7]])]);
 await page.locator('#selection-mode').selectOption('face');
 await pick([3,12,10]);
 await openingRow.nth(1).waitFor();
 await page.locator('#measurement-toggle').click();
 await pick([28,0,10]);
 assert.equal(await page.locator('#measurement-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await openingRow.nth(1).getByRole('button').evaluate(el=>el===document.activeElement),true);
 assert.ok(await openingRow.nth(1).evaluate(el=>el.classList.contains('opening-highlighted')));
 await openingRow.nth(0).getByRole('checkbox').check();
 await openingRow.nth(1).getByRole('checkbox').check();
 const clearance=length.getByRole('spinbutton',{name:'全周のすき間 (mm)'});
 const applyOpenings=length.getByRole('button',{name:'選んだ開口をスケッチ化'});
 await clearance.fill('8');
 assert.ok(await applyOpenings.isDisabled());
 await length.getByRole('status').filter({hasText:'開口 1'}).waitFor();
 await clearance.fill('0.2');
 await length.getByRole('status').filter({hasText:'緑は作成する輪郭'}).waitFor();
 await applyOpenings.click();
 const sketchGroup=page.locator('#sketches [data-sketch-group]');
 await sketchGroup.and(page.locator('[data-remaining-region-count="2"]')).waitFor();
 assert.equal(await sketchGroup.count(),1);
 const batchDownload=page.waitForEvent('download');
 page.once('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.locator('#save').click();
 const batchFile=JSON.parse(await fs.readFile(await (await batchDownload).path(),'utf8'));
 const batch=batchFile.features.filter(feature=>feature.kind==='sketch');
 assert.equal(batch.length,2);
 assert.equal(batch[0].groupId,batch[1].groupId);
 assert.ok(Math.abs(batch[0].diameter-15.6)<.001&&Math.abs(batch[0].x+20)<.001);
 const rectSides=[batch[1].width,batch[1].height].sort((a,b)=>a-b);
 assert.ok(Math.abs(rectSides[0]-13.6)<.001&&Math.abs(rectSides[1]-15.6)<.001&&Math.abs(batch[1].x-20)<.001);
 await page.locator('#undo').click();
 await sketchGroup.waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 console.log('PASS face measurement, rim picking, opening clearance and batch sketches, edge shortcuts, alignment, and shell');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
