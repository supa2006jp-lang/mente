import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {cadMesh} from '../src/cad-mesh.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const profile=R.makePolygon([[0,0,0],[70,0,0],[70,35,0],[60,45,0],[0,45,0]]),height=new R.Vector([0,0,22]);
const stock=R.basicFaceExtrusion(profile,height),bit=R.makeCylinder(3,26,[20,15,-2]),shape=stock.cut(bit);
const doc={format:'forma-cad',version:1,units:'mm',features:[{id:'source',kind:'cadop',name:'試験形状',remove:[],
 outputs:[{id:'body',...cadMesh(shape),brep:shape.serialize(),cadCoordinatePrecision:true}]}]};
for(const item of [profile,height,stock,bit,shape])item.delete();
const root=path.resolve('dist'),types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':decodeURIComponent(name)));
  if(!file.startsWith(root+path.sep))throw Error('Path outside dist');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1800,height:1350},acceptDownloads:true});
 page.setDefaultTimeout(35000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 const $=id=>page.locator('#'+id),drawing=id=>$('drawing-'+id),svg=drawing('preview').locator('svg');
 const view=name=>svg.locator('[data-view="'+name+'"]');
 const review=kind=>drawing('review-list').locator('[data-reference-review="'+kind+'"]');
 async function load(value){
  await $('file').setInputFiles({name:'front-change.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await $('project-preview-open').click();
  await page.waitForFunction(()=>!document.getElementById('project-load-preview').open&&document.getElementById('body-count').textContent==='1');
 }
 async function save(){
  const [event]=await Promise.all([page.waitForEvent('download'),$('save').evaluate(button=>button.click())]);
  return JSON.parse(await fs.readFile(await event.path(),'utf8'));
 }
 async function selectFace(point){
  await page.locator('[data-cube-kind="face"][data-view="right"]').click();
  await $('fit').click();
  await $('selection-mode').selectOption('face');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const host=$('canvas-host'),rect=await host.locator('canvas').boundingBox();
  const state=JSON.parse(await host.getAttribute('data-camera-state')),clip=JSON.parse(await host.getAttribute('data-camera-clip'));
  const camera=new THREE.OrthographicCamera(-100*rect.width/rect.height,100*rect.width/rect.height,100,-100,...clip);
  camera.position.fromArray(state);camera.quaternion.fromArray(state,3);camera.zoom=state[7];
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(...point).project(camera);
  await page.mouse.click(rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2);
  await $('measurement-face-body').waitFor();
 }
 async function drawingPoint(name,x,y){
  const group=view(name).locator('g[transform]').first();
  await group.scrollIntoViewIfNeeded();
  const point=await group.evaluate((element,uv)=>{
   const p=new DOMPoint(...uv).matrixTransform(element.getScreenCTM());
   return [p.x,p.y];
  },[x,y]);
  await page.mouse.click(...point);
 }
 const open=async()=>{await $('drawing-tool').click();await svg.waitFor();};
 const reorient=async()=>{
  await drawing('front-face').click();
  await drawing('front-reset').waitFor();
  await page.waitForFunction(()=>!document.getElementById('drawing-generate').disabled);
 };
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await $('canvas-host').locator('canvas').waitFor();
 await load(doc);
 const canonical=await save();
 const original={...canonical,drawing:{
  version:1,signature:drawingSignature(canonical.features),targets:['body'],targetMode:'visible',scale:1,hidden:true,
  comment:'図面メモ',dimensions:[
   {kind:'aligned',view:'front',a:[0,0],b:[70,0],at:[35,5],displayValue:70.01,precision:2,note:'参考'},
   {kind:'horizontal',view:'top',a:[0,-45],b:[60,-45],at:[30,-51]},
   {kind:'diameter',view:'top',center:[20,-15],radius:3,at:[26,-20]},
  ],dimensionPoints:[{id:'dimension-point-one',view:'front',point:[25,-11]}],
  options:{name:'向き変更の検証',material:'',date:'',frame:true,paper:'A4',orientation:'landscape',layout:'projection',
   viewSelection:['top','front','right'],isoMode:'hidden',positions:{},pdfLayout:'manual',
   pageAssignments:{pageCount:2,views:{top:1,front:2,right:1,'section-one':2,'detail-one':2},comments:{comment:2},holeTable:1},
   sections:[{id:'section-one',view:'top',orientation:'vertical',coordinate:32,reverse:false}],
   details:[{id:'detail-one',view:'front',center:[34,-12],radius:8,factor:2.4}],
   markers:[{id:'marker-one',kind:'center',view:'top',center:[20,-15],radius:3}],
   leaders:[{id:'leader-one',view:'front',anchor:[22,0],at:[26,12],text:'バリを除去'}],
   holeTable:{view:'top',origin:[0,0],lastNumber:7,holes:[{center:[20,-15],radius:3,number:7}]},
  },
 }};
 await load(original);
 await selectFace([70,17,12]);await open();await reorient();
 await view('left').waitFor();await view('section-one').waitFor();await view('detail-one').waitFor();
 assert.equal(await drawing('review-list').isHidden(),true);
 assert.equal(await svg.locator('[data-leader="leader-one"] text').textContent(),'バリを除去');
 assert.match(await svg.locator('[data-dimension="0"] text').textContent(),/70.01/);
 const exact=readDrawingState((await save()).drawing);
 assert.deepEqual(exact.dimensions.map(d=>[d.view,d.kind]),[['left','aligned'],['top','vertical'],['top','diameter']]);
 assert.equal(exact.options.pageAssignments.views.left,2);
 assert.equal(exact.options.pageAssignments.views.front,1);
 assert.equal(exact.options.pageAssignments.views['detail-one'],2);
 assert.equal(exact.options.sections[0].orientation,'horizontal');
 assert.equal(exact.options.details[0].view,'left');
 assert.equal(exact.options.details[0].factor,2.4);
 assert.deepEqual(exact.options.holeTable.holes[0],{number:7,center:[15,20],radius:3});
 assert.equal(exact.dimensionPoints[0].view,'left');
 assert.equal(exact.options.leaders[0].view,'left');
 await drawing('undo').click();
 await drawing('front-reset').waitFor({state:'hidden'});
 assert.equal(await view('left').count(),0);
 await drawing('redo').click();
 await view('left').waitFor();
 assert.deepEqual((await save()).drawing,exact);
 await drawing('front-reset').click();
 await drawing('front-reset').waitFor({state:'hidden'});
 await page.waitForFunction(()=>!document.getElementById('drawing-generate').disabled);
 const reset=readDrawingState((await save()).drawing);
 assert.deepEqual(reset.dimensions.map(d=>[d.view,d.kind]),original.drawing.dimensions.map(d=>[d.view,d.kind]));
 assert.equal(reset.options.leaders[0].view,'front');
 assert.equal(reset.options.sections[0].orientation,'vertical');

 await drawing('close').click();
 await load(original);
 await selectFace([65,40,12]);await open();await reorient();
 for(const kind of ['dimension','dimensionPoint','leader','section','detail'])await review(kind).waitFor();
 assert.equal(await svg.locator('[data-dimension="0"],[data-leader="leader-one"],[data-section="section-one"]').count(),0);
 assert.equal(await view('detail-one').count(),0);
 assert.equal(await svg.locator('[data-hole-row="H7"]').count(),1);
 const pending=await save(),saved=readDrawingState(pending.drawing);
 assert.equal(saved.dimensions[0].unplaced,true);
 assert.equal(saved.dimensions[1].kind,'aligned');
 assert.equal(saved.options.leaders[0].review,true);
 assert.equal(saved.options.leaders[0].text,'バリを除去');
 assert.equal(saved.options.details[0].factor,2.4);
 await drawing('close').click();await load(pending);await open();
 await review('leader').waitFor();
 await drawing('pdf-preview-open').click();
 const issue=page.locator('#drawing-pdf-preview-issues [data-pdf-issue="reference"]').filter({hasText:'バリを除去'});
 await issue.click();
 assert.equal(await drawing('leader-edit').inputValue(),'バリを除去');
 await drawing('annotation-relink').click();
 assert.equal(await drawing('leader-input').inputValue(),'バリを除去');
 await drawingPoint('front',8,-11);await drawingPoint('front',16,-3);
 await svg.locator('[data-leader="leader-one"]').waitFor();
 assert.equal(await review('leader').count(),0);
 await review('section').click();await drawing('extra-relink').click();
 await drawingPoint('front',8,-10);await view('section-one').waitFor();
 assert.equal(await review('section').count(),0);
 const restored=readDrawingState((await save()).drawing);
 assert.equal(restored.options.leaders[0].review,undefined);
 assert.equal(restored.options.sections[0].review,undefined);
 assert.equal(restored.options.pageAssignments.views['section-one'],2);
 assert.equal(restored.dimensions[0].unplaced,true);
 await review('dimension').click();await drawing('dimension-relink').click();
 await drawingPoint('top',0,0);await drawingPoint('top',-70/Math.SQRT2,70/Math.SQRT2);
 await drawingPoint('top',-35/Math.SQRT2,47/Math.SQRT2);
 await svg.locator('[data-dimension="0"]').waitFor();
 assert.equal(await review('dimension').count(),0);
 const relinked=readDrawingState((await save()).drawing).dimensions[0];
 assert.equal(relinked.view,'top');
 assert.equal(relinked.displayValue,70.01);
 assert.equal(relinked.note,'参考');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,url:page.url(),sameViews:true,obliqueReview:true,reset:true,undoRedo:true,
  reload:true,pdfReview:true,leaderRelink:true,sectionRelink:true,dimensionRelink:true}));
}catch(error){
 if(page)console.error(await page.locator('#drawing-status').textContent().catch(()=>''),error.message);
 throw error;
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
