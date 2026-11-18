import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import {readDrawingState} from '../src/drawing-state.js';

// Use the normal project-open and download paths against a running build.
const url=process.argv[2]??'http://127.0.0.1:5188/';
const plate={...defaults,id:'plate',name:'連結プレート',kind:'extrusion',width:60,height:28,depth:12};
const holes=[-19,0,16].map((x,i)=>({...defaults,id:'hole-'+i,name:'穴 Ø5',kind:'extrusion',operation:'cut',
 target:'plate',profile:'circle',plane:'CUSTOM',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},x,y:0,z:12,
 diameter:5,depth:i===1?-8:-12.01,hole:true,...(i===2?{counterbore:true,counterboreDiameter:9,counterboreDepth:3}:{})}));
const doc={format:'forma-cad',version:1,units:'mm',features:[plate,...holes]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1200},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(30000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 const drawing=id=>page.locator('#drawing-'+id);
 async function openProject(data,name){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(name=>document.querySelector('#project-file-name').textContent===name,name);
  await drawing('tool').click();
  await page.waitForFunction(()=>document.querySelector('#drawing-preview svg')&&!document.querySelector('#drawing-generate').disabled);
 }
 async function download(button){
  const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return {name:file.suggestedFilename(),bytes:await fs.readFile(await file.path())};
 }
 const cells=()=>drawing('preview').locator('[data-hole-table] text').allTextContents();
 await page.goto(url);
 await page.locator('#canvas-host canvas').waitFor();
 await openProject(doc,'plate.forma.json');
 await drawing('hole-start').click();
 await drawing('expand').click();
 const view=drawing('preview').locator('[data-view="top"] g[transform]').first();
 const point=await view.evaluate(el=>{
  const p=new DOMPoint(-30,14).matrixTransform(el.getScreenCTM());return [p.x,p.y];
 });
 await page.mouse.click(...point);
 await drawing('hole-all').click();
 await drawing('hole-add').click();
 await drawing('expand').click();
 const expected=['H1','11','14','5','貫通','—','—','H2','30','14','5','8','—','—','H3','46','14','5','貫通','9','3'];
 assert.deepEqual((await cells()).slice(8),expected);
 const fits=drawing('preview').locator('[data-hole-table]');
 assert.ok(await fits.evaluate(table=>{
  const lines=[...table.querySelectorAll('path')],limits=lines.map(line=>line.getBBox()).filter(b=>b.width===0).map(b=>b.x);
  return [...table.querySelectorAll('text')].slice(1).every((label,i)=>{
   const b=label.getBBox(),col=i%7;return b.x>=limits[col]&&b.x+b.width<=limits[col+1];
  });
 }));
 await drawing('name').fill('ロッカー連結プレート');
 await drawing('revision').fill('02');await drawing('revision').press('Tab');
 await drawing('undo').click();assert.equal(await drawing('revision').inputValue(),'');
 await drawing('redo').click();assert.equal(await drawing('revision').inputValue(),'02');
 const stem='ロッカー連結プレート_Rev02';
 const svg=await download(drawing('svg'));
 assert.equal(svg.name,stem+'.svg');assert.match(svg.bytes.toString(),/改訂番号/);assert.match(svg.bytes.toString(),/座ぐり深さ/);
 const pdf=await download(drawing('pdf'));
 assert.equal(pdf.name,stem+'.pdf');assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');
 await drawing('pdf-layout').selectOption('multi');
 await drawing('pdf-preview-open').click();await drawing('pdf-preview-next').click();
 assert.ok(await drawing('pdf-preview-host').locator('[data-hole-table]').isVisible());
 const preview=await download(drawing('pdf-preview-save'));
 assert.equal(preview.name,stem+'.pdf');assert.equal(preview.bytes.toString('latin1').match(/\/Type \/Page\b/g)?.length,2);
 await drawing('pdf-preview-close').click();await drawing('close').click();
 const saved=JSON.parse((await download(page.locator('#save'))).bytes);
 const {options}=readDrawingState(saved.drawing);
 assert.equal(options.revision,'02');assert.equal(options.holeTable.holes.length,3);
 assert.ok(options.holeTable.holes.every(hole=>!Object.hasOwn(hole,'machining')));
 await openProject(saved,'saved-plate.forma.json');
 assert.deepEqual((await cells()).slice(8),expected);
 assert.equal(await drawing('revision').inputValue(),'02');
 await drawing('close').click();
 // Model edit keeps the visible circle and its saved hole number.
 saved.features.find(f=>f.id==='hole-1').depth=-6;
 await openProject(saved,'updated-plate.forma.json');
 assert.equal((await cells())[19],'6');
 assert.deepEqual(errors,[]);
 console.log('PASS three hole specifications, revision undo/redo, SVG/PDF names, two-page preview, project reload and refreshed depth');
}finally{await browser.close();}
