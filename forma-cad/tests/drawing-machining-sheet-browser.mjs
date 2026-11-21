import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {defaults} from '../src/geometry.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';

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
 await page.waitForFunction(()=>typeof document.getElementById('file')?.onchange==='function');
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
 const previewRoot=drawing('preview'),row=id=>previewRoot.locator('[data-hole-row="'+id+'"]');
 const selectedIds=kind=>previewRoot.locator('[data-hole-'+kind+'][data-hole-selected]').evaluateAll((els,kind)=>els.map(el=>el.getAttribute('data-hole-'+kind)),kind);
 await row('H2').locator('text').nth(4).click();
 assert.deepEqual(await selectedIds('marker'),['H2']);assert.deepEqual(await selectedIds('row'),['H2']);
 const hit=previewRoot.locator('[data-hole-hit="H3"]');await hit.scrollIntoViewIfNeeded();
 const spot=await hit.evaluate(el=>{
  const p=new DOMPoint(+el.getAttribute('cx')-.65*el.getAttribute('r'),+el.getAttribute('cy')).matrixTransform(el.getScreenCTM());
  return [p.x,p.y];
 });
 await page.mouse.click(...spot);
 assert.deepEqual(await selectedIds('row'),['H3']);assert.deepEqual(await selectedIds('hit'),['H3']);
 await row('H1').focus();await page.keyboard.press('Enter');
 assert.deepEqual(await selectedIds('marker'),['H1']);
 assert.doesNotMatch((await download(drawing('svg'))).bytes.toString(),/data-hole-selected|data-hole-hit|aria-pressed/);
 await drawing('pdf-preview-open').click();
 assert.equal(await drawing('pdf-preview-host').locator('[data-hole-selected],[data-hole-hit]').count(),0);
 await drawing('pdf-preview-close').click();
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
 await drawing('pdf').click();
 const pdf=await download(page.locator('#export-confirm'));
 assert.equal(pdf.name,stem+'.pdf');assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');
 await drawing('pdf-layout').selectOption('multi');
 await drawing('pdf-preview-open').click();await drawing('pdf-preview-next').click();
 assert.ok(await drawing('pdf-preview-host').locator('[data-hole-table]').isVisible());
 const preview=await download(drawing('pdf-preview-save'));
 assert.equal(preview.name,stem+'.pdf');assert.equal(preview.bytes.toString('latin1').match(/\/Type \/Page\b/g)?.length,2);
 const pages=drawing('pdf-preview-pages'),tableItem=pages.locator('[data-pdf-page="2"] [data-page-item=holeTable]');
 await tableItem.click();
 const move=pages.locator('.drawing-pdf-page-move');
 await move.locator('select').selectOption('0');
 await move.getByRole('button',{name:'移動',exact:true}).click();
 assert.equal(await pages.locator('[data-pdf-page="1"] [data-page-item=holeTable]').count(),1);
 assert.match(await pages.locator('[data-pdf-page="2"]').textContent(),/空白ページ/);
 assert.deepEqual((await drawing('pdf-preview-host').locator('[data-hole-table] text').allTextContents()).slice(8),expected);
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
 await drawing('close').click();
 await page.locator('#features [data-history-feature="hole-1"] .row-label').click();
 const xInput=page.locator('#x');await xInput.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 await xInput.fill('1');await page.locator('#apply').click();await drawing('tool').click();
 await page.waitForFunction(()=>document.querySelector('#drawing-preview svg')&&!document.querySelector('#drawing-generate').disabled);
 assert.deepEqual((await cells()).slice(8),expected.map((value,i)=>i===8?'31':i===11?'6':value));
 assert.equal(await drawing('hole-review').isVisible(),false);
 await drawing('close').click();
 const moved=JSON.parse((await download(page.locator('#save'))).bytes);
 // Supply the replacement's input features, so a cached solid from the prior machining
 // operation cannot be reused for a different feature ID.
 moved.features=structuredClone(doc.features);
 const replacement=moved.features.find(f=>f.id==='hole-1');
 replacement.id='different-hole';replacement.x=5;replacement.depth=-6;
 await openProject(moved,'different-hole.forma.json');
 assert.deepEqual((await cells()).slice(15,22),['H2','—','—','—','要確認','—','—']);
 await row('H2').locator('text').first().click();
 assert.deepEqual(await selectedIds('row'),['H2']);assert.deepEqual(await selectedIds('marker'),[]);
 assert.match((await download(drawing('svg'))).bytes.toString(),/要確認/);
 await drawing('pdf-preview-open').click();await drawing('pdf-preview-next').click();
 assert.match(await drawing('pdf-preview-host').locator('[data-hole-table]').textContent(),/H2.*要確認/);
 await drawing('pdf-preview-close').click();
 await drawing('hole-remove-row').click();
 assert.deepEqual((await cells()).filter(v=>/^H\d+$/.test(v)),['H1','H3']);
 await row('H3').locator('text').first().click();assert.deepEqual(await selectedIds('marker'),['H3']);
 await drawing('undo').click();
 await drawing('hole-relink').click();await drawing('expand').click();
 const newPoint=await view.evaluate(el=>{const p=new DOMPoint(5,0).matrixTransform(el.getScreenCTM());return [p.x,p.y];});
 await page.mouse.click(...newPoint);await drawing('expand').click();
 assert.deepEqual((await cells()).slice(15,22),['H2','35','14','5','6','—','—']);
 await drawing('close').click();

 const base={...plate,width:40,height:25,depth:20,x:20,y:12.5},cut={...holes[0],x:10,y:8,z:20,diameter:8,depth:-20.01};
 const sample={...doc,features:[base,cut]},section={id:'section-a',view:'top',orientation:'vertical',coordinate:10,reverse:false};
 sample.drawing={version:1,signature:drawingSignature(sample.features),targets:['plate'],targetMode:'visible',dimensions:[],hidden:true,scale:1,comment:'',
  options:{paper:'A4',orientation:'landscape',frame:true,name:'断面試験',material:'',date:'',positions:{},sections:[section]}};
 await openProject(sample,'section-edit.forma.json');
 const svgRoot=drawing('preview').locator('svg'),values=()=>svgRoot.locator('[data-dimension] text').allTextContents();
 const generated=()=>page.waitForFunction(()=>!document.querySelector('#drawing-generate').disabled&&document.querySelector('#drawing-preview svg'));
 await drawing('dimension-auto').click();
 const before=await values();assert.ok(before.includes('4')&&before.includes('13'));
 const pos=drawing('section-position');
 await pos.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 async function moveSection(value){await pos.fill(String(value));await pos.press('Tab');await generated();}
 await moveSection(11);
 const followed=await values();assert.equal(followed.length,before.length);assert.ok(followed.includes('4.127')&&followed.includes('13.127'));
 await moveSection(18);
 assert.equal((await values()).length,before.length);assert.equal((await values()).filter(v=>v==='要確認').length,2);
 assert.match((await download(drawing('svg'))).bytes.toString(),/要確認/);
 await drawing('undo').click();await generated();assert.equal(await pos.inputValue(),'11');assert.deepEqual(await values(),followed);
 await drawing('expand').click();
 const sectionView=svgRoot.locator('[data-view="top"] g[transform]').first();
 const sectionPoint=x=>sectionView.evaluate((el,x)=>{const p=new DOMPoint(x,-16).matrixTransform(el.getScreenCTM());return [p.x,p.y];},x);
 const from=await sectionPoint(11),to=await sectionPoint(12.5);
 await page.keyboard.down('Alt');await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps:7});await page.mouse.up();await page.keyboard.up('Alt');await generated();
 assert.ok(Math.abs(Number(await pos.inputValue())-12.5)<.1);assert.equal((await values()).length,before.length);
 await drawing('expand').click();await drawing('undo').click();await generated();assert.equal(await pos.inputValue(),'11');
 await moveSection(1000);assert.equal(await pos.inputValue(),'11');assert.deepEqual(await values(),followed);
 await drawing('section-reverse').click();await generated();assert.equal((await values()).length,before.length);
 await drawing('close').click();
 const savedSection=JSON.parse((await download(page.locator('#save'))).bytes);
 await openProject(savedSection,'section-reload.forma.json');
 assert.equal((await values()).length,before.length);assert.equal(await pos.inputValue(),'11');
 await drawing('close').click();

 await openProject(doc,'third-angle.forma.json');
 const lock=drawing('projection-lock');await lock.check();assert.equal(await svgRoot.getAttribute('data-layout'),'projection');
 await drawing('scale').selectOption('1');await drawing('layout-mode').check();await drawing('expand').click();
 const place=name=>svgRoot.locator('[data-view="'+name+'"] g[transform]').first().evaluate(el=>{
  const m=el.transform.baseVal.getItem(0).matrix;return [m.e,m.f];
 });
 async function drag(name,dx,dy){
  const label=svgRoot.locator('[data-view="'+name+'"] > text').first();await label.scrollIntoViewIfNeeded();
  const box=await label.boundingBox(),scale=await svgRoot.evaluate(el=>el.getScreenCTM().a),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.keyboard.down('Alt');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx*scale,y+dy*scale,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
 }
 const nearly=(a,b)=>assert.ok(Math.abs(a-b)<.1,a+' versus '+b);
 async function checkHorizontalReturn(){
  const label=svgRoot.locator('[data-view="front"] > text');await label.scrollIntoViewIfNeeded();
  const matrix=()=>svgRoot.evaluate(svg=>{const m=svg.getScreenCTM();return [m.a,m.e,m.f];});
  const before=await matrix(),box=await label.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const start=await place('front'),startTop=await place('top');
  await page.mouse.move(x,y);await page.mouse.down();
  for(const dx of [-8,-18,-27]){
   await page.mouse.move(x+dx*before[0],y,{steps:3});
   const now=await matrix();now.forEach((v,i)=>nearly(v,before[i]));
   nearly((await place('front'))[1],start[1]);nearly((await place('top'))[1],startTop[1]);
  }
  assert.ok(await svgRoot.locator('[data-overflow-outline]').count()>0);
  await page.mouse.move(x,y,{steps:8});await page.mouse.up();
  for(const [name,from] of [['front',start],['top',startTop]])(await place(name)).forEach((v,i)=>nearly(v,from[i]));
  assert.equal(await svgRoot.locator('[data-overflow-outline]').count(),0);
 }
 await checkHorizontalReturn();
 await drawing('expand').click();await checkHorizontalReturn();await drawing('expand').click();
 let top=await place('top'),front=await place('front'),right=await place('right');
 await drag('top',18,3);nearly((await place('top'))[0],front[0]);nearly((await place('top'))[1],top[1]+3);
 await drag('right',5,10);nearly((await place('right'))[1],front[1]);nearly((await place('right'))[0],right[0]+5);
 top=await place('top');right=await place('right');
 await drag('front',4,2);front=await place('front');
 nearly((await place('top'))[0],front[0]);nearly((await place('top'))[1],top[1]+2);
 nearly((await place('right'))[1],front[1]);nearly((await place('right'))[0],right[0]+4);
 await drawing('expand').click();await lock.uncheck();await drawing('expand').click();
 await drag('top',13,0);nearly((await place('top'))[0],front[0]+13);
 assert.match(await svgRoot.locator('text').first().textContent(),/VIEW LAYOUT/);
 await drawing('expand').click();await lock.check();nearly((await place('top'))[0],front[0]);
 assert.match((await download(drawing('svg'))).bytes.toString(),/THIRD ANGLE/);
 await drawing('undo').click();assert.equal(await lock.isChecked(),false);
 await drawing('redo').click();assert.equal(await lock.isChecked(),true);
 await drawing('close').click();
 const locked=JSON.parse((await download(page.locator('#save'))).bytes);
 assert.equal(readDrawingState(locked.drawing).options.projectionLocked,true);
 await openProject(locked,'locked.forma.json');assert.equal(await lock.isChecked(),true);nearly((await place('top'))[0],(await place('front'))[0]);
 assert.deepEqual(errors,[]);
 console.log('PASS hole specs, stable numbers, reviewed rows in exports and manual relink, section dimensions and undo, third-angle drag lock, names and reload');
}finally{await browser.close();}
