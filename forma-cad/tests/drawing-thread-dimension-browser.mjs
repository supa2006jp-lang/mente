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
const smallHole={...hole,name:'小径穴',id:'small-hole',diameter:.6,x:-10,y:-9};
const thread={type:'thread',id:'tapped',target:'plate',profile:'metric60',threadVersion:2,
 surfacePoint:[3,0,9],pitch:1,fullLength:true};
const screw={type:'freeScrew',id:'bolt',origin:[40,5,0],diameter:10,pitch:1.5,length:5,
 head:'hex',headSize:16.7,headHeight:4,drive:'none',headDown:true,tipChamfer:.5,
 nut:{id:'nut',shape:'round',height:4,wall:2.5,autoPull:true,clearance:.2}};
const cad=(features,spec)=>({kind:'cadop',name:spec.id,id:spec.id,spec,...runOperation(features,spec)});
const boltAndNut=cad([],screw);
const move={type:'move',id:'nut-copy',target:'nut',copy:true,x:-30,y:25,z:0,angle:0,axis:'Z'};
const duplicateNut=cad([boltAndNut],move);
const features=[plate,hole,smallHole,cad([plate,hole,smallHole],thread),boltAndNut,duplicateNut];
const targets=['plate','bolt','nut','nut-copy'];
const [nutX,nutY]=boltAndNut.analysis.nut.position;
const adjustedLabel='Ø10.4（使用ボルトはM10）',groupedLabel='2×'+adjustedLabel;
const expected=['M6','M10',adjustedLabel],merged=['M6','M10',groupedLabel];
const project={format:'forma-cad',version:1,features,drawing:{version:1,signature:drawingSignature(features),
 targets,targetMode:'visible',scale:2,hidden:true,comment:'',dimensions:[],
 options:{paper:'A3',orientation:'landscape',name:'ねじ寸法',material:'',date:'',frame:true,
  viewSelection:['top','front','right'],isoMode:'hidden',positions:{top:[45,42],front:[45,171],right:[280,171],holeTable:[280,42]}}}};

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
 page.setDefaultTimeout(90000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>window.showSaveFilePicker=undefined);
 const $=id=>page.locator('#'+id),field=id=>$('drawing-'+id);
 const preview=field('preview'),view=preview.locator('[data-view="top"] > g[transform]');
 const labels=()=>preview.locator('[data-dimension] text').allTextContents();
 const projectionScales=()=>Promise.all(['top','front','right'].map(async name=>{
  const transform=await preview.locator(`[data-view="${name}"] > g[transform]`).getAttribute('transform');
  return Number(transform.match(/scale\(([^)]+)\)/)[1]);
 }));
 async function open(doc){
  await $('file').setInputFiles({name:'thread-dimensions.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await $('project-preview-open').click();
  await $('project-load-preview').waitFor({state:'hidden'});
  await field('tool').click();
  try{
   await page.waitForFunction(()=>document.getElementById('drawing-dialog').open&&!document.getElementById('drawing-generate').disabled);
  }catch(error){
   const status=await field('status').textContent({timeout:3000}).catch(()=>null);
   throw Error([status,...errors].filter(Boolean).join(' / ')||'Drawing did not finish loading',{cause:error});
  }
  assert.equal(await view.count(),1,await field('status').textContent());
  await view.waitFor();
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
  assert.ok((await field('status').textContent()).includes('ねじ寸法 '+text));
  await page.mouse.click(...await screen(at));
  assert.equal((await labels()).at(-1),text);
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await $('canvas-host').locator('canvas').waitFor();
 await open(project);
 await field('dimension-auto').click();
 const automatic=await labels();
 assert.equal(automatic.filter(label=>label===groupedLabel).length,1);
 assert.ok(automatic.includes('2×Ø15'));
 assert.ok(!automatic.includes('Ø10.4'));
 const omitted=field('omitted-hole');
 const small=await omitted.locator('option').filter({hasText:/TOP.*Ø0\.6/}).getAttribute('value');
 await omitted.selectOption(small);
 assert.equal(await preview.locator('[data-omitted-hole-highlight]').count(),1);
 await field('omitted-hole-add').click();
 assert.equal((await labels()).filter(label=>label==='Ø0.6').length,1);
 assert.equal(await omitted.locator('option').filter({hasText:/TOP.*Ø0\.6/}).count(),0);
 await field('undo').click();
 await field('zoom-fit').click();
 assert.deepEqual(await labels(),automatic);
 assert.equal(await omitted.locator('option').filter({hasText:/TOP.*Ø0\.6/}).count(),1);
 await field('dimension-auto').click();
 assert.deepEqual(await labels(),automatic);
 const link=field('link-scales');
 await link.check();
 await field('view-scales').evaluate(panel=>panel.open=true);
 const scale=field('view-scales').locator('[data-view-scale-input="top"]');
 await scale.fill('1.5');
 await scale.press('Enter');
 assert.deepEqual(await projectionScales(),[1.5,1.5,1.5]);
 assert(await link.isChecked());
 await field('dimension-auto').click();
 assert.deepEqual(await projectionScales(),[1.5,1.5,1.5]);
 assert(await link.isChecked());
 await field('pdf-preview-open').click();
 const pdf=await field('pdf-preview-host').locator('[data-dimension] text').allTextContents();
 assert.equal(pdf.filter(label=>label===groupedLabel).length,1);
 await field('pdf-preview-close').click();
 const corner=preview.locator('[data-view-resize="right"]');
 await corner.scrollIntoViewIfNeeded();
 const box=await corner.boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x+20,y+10,{steps:5});
 await page.mouse.up();
 const [resizedTop,resizedFront,resizedRight]=await projectionScales();
 assert(resizedRight>1.5&&resizedTop===resizedRight&&resizedFront===resizedRight);
 assert(await link.isChecked());
 await field('undo').click();
 assert.deepEqual(await projectionScales(),[1.5,1.5,1.5]);
 await field('undo').click();
 assert.deepEqual(await projectionScales(),[2,2,2]);
 assert(await link.isChecked());
 await field('undo').click();
 assert(!(await link.isChecked()));
 await field('undo').click();
 assert.deepEqual(await labels(),[]);
 await add([3,0],[10,-24],'M6');
 await add([45,-5],[44,-20],'M10');
 await add([nutX+5.2,-nutY],[nutX,13],adjustedLabel);
 assert.deepEqual(await labels(),expected);
 await field('undo').click();
 assert.deepEqual(await labels(),expected.slice(0,2));
 await field('redo').click();
 assert.deepEqual(await labels(),expected);
 await add([nutX+move.x+5.2,-nutY-move.y],[nutX+move.x,-nutY-move.y+13],adjustedLabel);
 await field('dimension-group').click();
 assert.deepEqual(await labels(),merged);
 await field('undo').click();
 assert.deepEqual(await labels(),[...expected,adjustedLabel]);
 await field('redo').click();
 assert.deepEqual(await labels(),merged);
 await field('thread-leader-start').click();
 await page.mouse.click(...await screen([nutX,-nutY]));
 await page.mouse.click(...await screen([nutX+21,-nutY+18]));
 await field('hole-start').click();
 await page.mouse.click(...await screen([-18,-15]));
 const filter=field('hole-filter'),candidates=preview.locator('[data-hole-candidate]');
 await filter.selectOption('thread');
 assert.equal(await candidates.count(),3);
 await filter.selectOption('through');
 assert.equal(await candidates.count(),2);
 await field('hole-all').click();
 assert.equal(await preview.locator('[data-hole-candidate-selected="true"]').count(),2);
 await filter.selectOption('blind');
 assert.equal(await candidates.count(),2);
 assert.match(await field('status').textContent(),/表示外 2 件/);
 await field('hole-clear-selection').click();
 assert(await field('hole-add').isDisabled());
 await filter.selectOption('through');
 await field('hole-all').click();
 await field('hole-add').click();
 async function assertThreadNotes(host){
  assert.equal(await host.locator('[data-hole-row]').count(),2);
  for(const selector of ['[data-leader] text','[data-hole-row="H1"] text','[data-hole-row="H2"] text']){
   const lines=await host.locator(selector).allTextContents();
   assert.ok(lines.includes(adjustedLabel),lines.join(' / '));
  }
 }
 await assertThreadNotes(preview);
 await field('pdf-preview-open').click();
 assert.deepEqual(await field('pdf-preview-host').locator('[data-dimension] text').allTextContents(),merged);
 await assertThreadNotes(field('pdf-preview-host'));
 await field('pdf-preview-close').click();
 await link.check();
 await field('close').click();
 const [download]=await Promise.all([page.waitForEvent('download'),$('save').evaluate(button=>button.click())]);
 const saved=JSON.parse(await readFile(await download.path(),'utf8'));
 const drawing=readDrawingState(saved.drawing);
 assert.equal(drawing.options.linkedProjectionScales,true);
 assert.deepEqual(drawing.dimensions.map(d=>[d.kind,d.nominalDiameter,d.threadRim]),
  [['thread',6,'bore'],['thread',10,'shaft'],['thread',10,'bore']]);
 assert.equal(drawing.dimensions[2].adjustedDiameter,10.4);
 assert.equal(drawing.dimensions[2].count,2);
 assert.deepEqual(drawing.dimensions[2].threadRefs.map(ref=>ref.bodyId),['nut','nut-copy']);
 await open({...saved,drawing});
 assert.deepEqual(await labels(),merged);
 await assertThreadNotes(preview);
 assert(await link.isChecked());
 assert.deepEqual(errors,[]);
 console.log('PASS grouped thread dimensions, filtered hole table, PDF preview, linked scales and reopening');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
