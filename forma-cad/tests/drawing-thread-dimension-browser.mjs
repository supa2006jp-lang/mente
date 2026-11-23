import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const plate={...defaults,kind:'extrusion',name:'プレート',id:'plate',width:44,height:38,depth:12};
const hole={...defaults,kind:'extrusion',name:'下穴',id:'hole',target:'plate',hole:true,
 profile:'circle',operation:'cut',diameter:6,z:12,depth:-5};
const thread={type:'thread',id:'tapped',target:'plate',profile:'metric60',threadVersion:2,
 surfacePoint:[3,0,9],pitch:1,fullLength:true};
const screw={type:'freeScrew',id:'bolt',origin:[40,5,0],diameter:8,pitch:1.25,length:5,
 head:'hex',headSize:13,headHeight:4,drive:'none',headDown:true,tipChamfer:.5};
const cad=(features,spec)=>({kind:'cadop',name:spec.id,id:spec.id,spec,...runOperation(features,spec)});
const features=[plate,hole,cad([plate,hole],thread),cad([],screw)];
const targets=['plate','bolt'];
const project={format:'forma-cad',version:1,features,drawing:{version:1,signature:drawingSignature(features),
 targets,targetMode:'visible',scale:2,hidden:true,comment:'',dimensions:[],
 options:{paper:'A4',orientation:'landscape',name:'ねじ寸法',material:'',date:'',frame:true,
  viewSelection:['top'],isoMode:'hidden',positions:{top:[45,42]}}}};

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const buffer=await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(buffer);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1760,height:1120},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 const $=id=>page.locator('#'+id),field=id=>$('drawing-'+id);
 const preview=field('preview'),view=preview.locator('[data-view="top"] > g[transform]');
 const labels=()=>preview.locator('[data-dimension] text').allTextContents();
 async function open(doc){
  await $('file').setInputFiles({name:'thread-dimensions.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await $('project-preview-open').click();
  await $('project-load-preview').waitFor({state:'hidden'});
  await field('tool').click();
  await view.waitFor();
  await page.waitForFunction(()=>!document.getElementById('drawing-generate').disabled);
 }
 async function screen(point){
  return view.evaluate((group,coordinates)=>{
   const p=new DOMPoint(...coordinates).matrixTransform(group.getScreenCTM());
   return [p.x,p.y];
  },point);
 }
 async function add(rim,at,text){
  await field('dimension-kind').selectOption('thread');
  await field('dimension-add').click();
  assert.match(await field('dimension-hint').textContent(),/ねじ.*外周/);
  const point=await screen(rim);
  await page.mouse.move(...point);
  assert.equal(await field('snap-label').textContent(),text);
  assert.equal(await preview.locator('[data-dimension-hover="arc"]').count(),1);
  await page.mouse.click(...point);
  assert.match(await field('status').textContent(),new RegExp('ねじ寸法 '+text));
  await page.mouse.click(...await screen(at));
  assert.equal((await labels()).at(-1),text);
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await $('canvas-host').locator('canvas').waitFor();
 await open(project);
 await add([3,0],[10,-24],'M6');
 await add([44,-5],[50,9],'M8');
 assert.deepEqual(await labels(),['M6','M8']);
 await field('undo').click();
 assert.deepEqual(await labels(),['M6']);
 await field('redo').click();
 assert.deepEqual(await labels(),['M6','M8']);
 await field('pdf-preview-open').click();
 assert.deepEqual(await field('pdf-preview-host').locator('[data-dimension] text').allTextContents(),['M6','M8']);
 await field('pdf-preview-close').click();
 await field('close').click();
 const [download]=await Promise.all([page.waitForEvent('download'),$('save').evaluate(button=>button.click())]);
 const saved=JSON.parse(await readFile(await download.path(),'utf8'));
 const drawing=readDrawingState(saved.drawing);
 assert.deepEqual(drawing.dimensions.map(d=>[d.kind,d.nominalDiameter,d.threadRim]),[['thread',6,'bore'],['thread',8,'shaft']]);
 await open(saved);
 assert.deepEqual(await labels(),['M6','M8']);
 assert.deepEqual(errors,[]);
 console.log('PASS M6 tapped-hole rim and M8 chamfered screw outer rim, hover, placement, undo/redo, PDF preview and reopening');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
