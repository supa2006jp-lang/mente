import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';

const plate={...defaults,id:'plate',name:'プレート',kind:'extrusion',width:60,height:28,depth:12};
const holes=[-19,0,16].map((x,i)=>({...defaults,id:'hole-'+i,name:'穴 '+(i+1),kind:'extrusion',operation:'cut',
 target:'plate',profile:'circle',plane:'CUSTOM',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},x,y:0,z:12,
 diameter:5,depth:-12.01,hole:true}));
const features=[plate,...holes];
const fixture={format:'forma-cad',version:1,units:'mm',features,drawing:{
 version:1,signature:drawingSignature(features),targets:['plate'],targetMode:'visible',hidden:true,scale:1,comment:'',
 dimensions:[{view:'top',kind:'horizontal',a:[-30,14],b:[30,14],at:[0,26]}],
 options:{paper:'A4',orientation:'landscape',frame:true,name:'プレート',material:'',date:'',viewSelection:['top'],isoMode:'hidden',
  positions:{top:[40,60],holeTable:[145,55]},holeTable:{view:'top',origin:[-30,14],
   holes:[{center:[-19,0],radius:2.5},{center:[16,0],radius:2.5}]}}}};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 const d=id=>page.locator('#drawing-'+id),target=d('target');
 const ready=()=>page.waitForFunction(()=>document.querySelector('#drawing-preview svg')&&!document.querySelector('#drawing-generate').disabled);
 async function load(doc,name){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(name=>document.querySelector('#project-file-name').textContent===name,name);
 }
 async function open(){await d('tool').click();await ready();}
 async function download(button){
  const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return fs.readFile(await file.path());
 }
 const rows=()=>d('preview').locator('[data-hole-row]').evaluateAll(rows=>
  rows.map(r=>[...r.querySelectorAll('text')].slice(0,3).map(el=>el.textContent)));
 const dims=()=>d('preview').locator('[data-dimension] text').allTextContents();
 async function visibleWorkspace(){
  const boxes=await page.evaluate(()=>['preview','pdf','svg','pdf-preview-open'].map(id=>{
   const el=document.getElementById('drawing-'+id),b=el.getBoundingClientRect();
   const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return {id,visible:b.width>0&&b.top>=0&&b.left>=0&&b.bottom<=innerHeight&&b.right<=innerWidth&&el.contains(hit),height:b.height};
  }));
  for(const b of boxes)assert.ok(b.visible,b.id+' should be visible and reachable');
  assert.ok(boxes[0].height>200);
 }
 const existing=[['H1','11','14'],['H2','46','14']],appended=[...existing,['H3','30','14']];
 await page.goto(process.argv[2]??'http://127.0.0.1:5188/');
 await page.locator('#canvas-host canvas').waitFor();
 await load(fixture,'legacy-table.forma.json');
 const plateRow=page.locator('#bodies [data-body-id="plate"] .row-label');
 await plateRow.click();await plateRow.click({modifiers:['Control']});await open();
 assert.equal(await d('settings-toggle').getAttribute('aria-expanded'),'false');
 await visibleWorkspace();await d('settings-toggle').click();await visibleWorkspace();
 assert.deepEqual(await dims(),['60']);assert.deepEqual(await rows(),existing);
 assert.ok(await target.locator('option[value=selected]').evaluate(option=>option.disabled));
 await target.evaluate(el=>{el.value='selected';el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await target.inputValue(),'visible');assert.deepEqual(await dims(),['60']);assert.deepEqual(await rows(),existing);

 await d('hole-start').click();await d('hole-all').click();await d('dimension-cancel').click();
 assert.deepEqual(await rows(),existing);
 await d('hole-start').click();
 const center=await d('preview').locator('[data-view="top"] g[transform]').first().evaluate(el=>{
  const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM());return [p.x,p.y];
 });
 await page.mouse.click(...center);await d('hole-add').click();
 assert.deepEqual(await rows(),appended);
 await d('undo').click();assert.deepEqual(await rows(),existing);
 await d('redo').click();assert.deepEqual(await rows(),appended);
 await d('hole-start').click();assert.equal(await d('hole-add').isVisible(),false);
 await d('settings-toggle').click();await d('expand').click();await visibleWorkspace();
 await d('pdf-preview-open').click();
 assert.equal(await d('pdf-preview-host').locator('[data-hole-row="H3"] text').nth(1).textContent(),'30');
 await d('pdf-preview-close').click();
 assert.match((await download(d('svg'))).toString(),/data-hole-row="H3"/);
 assert.equal((await download(d('pdf'))).subarray(0,5).toString(),'%PDF-');
 await d('expand').click();await visibleWorkspace();await d('close').click();
 const saved=JSON.parse(await download(page.locator('#save')));
 const state=readDrawingState(saved.drawing);
 assert.deepEqual(state.options.holeTable.origin,[-30,14]);
 assert.deepEqual(state.options.positions,fixture.drawing.options.positions);
 await load(saved,'appended.forma.json');
 await page.locator('#bodies [data-body-id="plate"] .row-label').click();await open();
 await d('settings-toggle').click();
 await target.selectOption('selected');await ready();
 assert.deepEqual(await rows(),appended);assert.deepEqual(await dims(),['60']);
 await d('undo').click();assert.equal(await target.inputValue(),'visible');
 await d('redo').click();assert.equal(await target.inputValue(),'selected');
 await target.selectOption('visible');assert.deepEqual(await rows(),appended);await d('close').click();

 const multi=structuredClone(saved);
 multi.features.push({...plate,id:'other',name:'別ボディ',x:95});
 multi.drawing.signature=drawingSignature(multi.features);multi.drawing.targets=['plate','other'];
 await load(multi,'two-bodies.forma.json');
 await page.locator('#bodies [data-body-id="plate"] .row-label').click();await open();
 await target.selectOption('selected');await ready();
 assert.deepEqual(await rows(),appended);assert.deepEqual(await dims(),['要確認']);
 await d('undo').click();await ready();assert.equal(await target.inputValue(),'visible');assert.deepEqual(await dims(),['60']);
 await d('redo').click();await ready();assert.equal(await target.inputValue(),'selected');
 assert.deepEqual(await rows(),appended);assert.deepEqual(await dims(),['要確認']);
 assert.deepEqual(errors,[]);
 console.log('PASS 1366x768 paper and exports, empty/same/different target protection, legacy table append, undo/redo and reload');
}finally{await browser.close();}
