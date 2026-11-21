import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {decodeProjectDocument} from '../src/project-codec.js';
import {drawingSignature} from '../src/drawing-state.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const shape=R.makeBox([0,0,0],[60,40,20]);
const features=[{kind:'cadop',id:'plate',name:'検証プレート',remove:[],
 outputs:[{id:'plate',brep:shape.serialize(),...shape.mesh({tolerance:.1,angularTolerance:.2})}]}];
shape.delete();
const width={view:'front',kind:'horizontal',a:[0,0],b:[60,0],at:[30,8]};
const drawing={version:1,signature:drawingSignature(features),targets:['plate'],targetMode:'visible',scale:1,hidden:true,
 comment:'切断位置を確認',dimensions:[width,{...width,a:[10,0],b:[50,0]},
  {view:'right',kind:'horizontal',a:[0,0],b:[40,0],at:[20,10],review:true}],
 options:{paper:'A4',orientation:'landscape',name:'検証プレート',material:'PETG',date:'',frame:true,layout:'projection',projectionLocked:true,
  viewSelection:['top','front','right'],isoMode:'hidden',positions:{front:[45,100],top:[45,35],right:[141,100],'section-a':[210,48],comment:[206,94]},
  sections:[{id:'section-a',view:'front',orientation:'vertical',coordinate:30,reverse:false}],
  pdfLayout:'manual',pageAssignments:{pageCount:2,views:{},comments:{comment:2}}},
};
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep))throw Error('invalid path');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1540,height:1070},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 const field=id=>page.locator('#drawing-'+id);
 const preview=field('pdf-preview'),print=field('pdf-preview-host'),editor=field('preview');
 const geometry=(host,view)=>host.locator(`[data-view="${view}"]>g[transform]`).getAttribute('transform');
 const commentX=host=>host.locator('[data-comment=true] text').first().getAttribute('x');
 const pdfPage=number=>preview.locator('[data-pdf-page="'+number+'"]');
 const selectPage=number=>pdfPage(number).locator('.drawing-pdf-page-thumb').click();
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>typeof document.getElementById('file')?.onchange==='function');

 async function open(state,view='front'){
  const project={format:'forma-cad',version:1,features,drawing:state};
  await page.locator('#file').setInputFiles({name:'drawing-pdf-check.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.locator('#project-preview-open').click();
  await field('tool').click();
  await editor.locator('[data-view="'+view+'"]').waitFor();
 }

 await open(drawing);
 assert.equal(await field('pdf-placement').inputValue(),'keep');
 const assignments=field('page-assignments');
 assert(await assignments.isVisible());
 const [pageLayoutBox,assignmentsBox]=await Promise.all([field('pdf-layout').boundingBox(),assignments.boundingBox()]);
 assert(assignmentsBox.y>=pageLayoutBox.y+pageLayoutBox.height);
 assert.deepEqual(await assignments.evaluate(panel=>[
  panel.previousElementSibling?.querySelector('select')?.id,panel.nextElementSibling?.id,panel.nextElementSibling?.nextElementSibling?.id,
 ]),['drawing-pdf-layout','drawing-page-scales','drawing-pdf-placement-label']);
 const pagesNote=field('pdf-pages-note');
 assert(await pagesNote.isVisible());
 assert.match(await pagesNote.textContent(),/2 ページ.*編集するページ/);
 await field('pdf-layout').selectOption('');
 assert(await pagesNote.isHidden());
 assert(await assignments.isHidden());
 await field('pdf-layout').selectOption('manual');
 assert(await assignments.evaluate(panel=>panel.open));
 await field('page-count').fill('1');await field('page-count').press('Tab');
 assert(await pagesNote.isHidden());
 await field('page-count').fill('2');await field('page-count').press('Tab');
 assert(await pagesNote.isVisible());
 await field('pdf-layout').selectOption('multi');
 assert(await pagesNote.isVisible());
 await field('pdf-layout').selectOption('manual');
 await field('pdf').click();
 assert.equal(await page.locator('#export-format').inputValue(),'pdf');
 assert.match(await page.locator('#export-contents').textContent(),/1 ページ.*2 ページ/);
 await page.locator('#export-confirm').click();
 await preview.waitFor();
 assert.match(await field('pdf-preview-check-summary').textContent(),/寸法の重なり 2 件.*参照先を要確認 1 件/);
 assert.equal(await geometry(print,'top'),await geometry(editor,'top'));
 assert.equal(await geometry(print,'right'),await geometry(editor,'right'));
 await preview.locator('[data-pdf-issue=reference]').click();
 assert(await preview.isHidden());
 assert.equal(await editor.locator('[data-dimension="2"][data-edit-selected]').count(),1);
 await field('pdf-preview-open').click();
 await preview.locator('[data-pdf-issue=overlap]').first().click();
 assert(await preview.isHidden());
 assert.equal(await editor.locator('[data-focused-conflict]').count(),1);

 await field('close').click();
 const overflow={...drawing,dimensions:[width],options:{...drawing.options,positions:{...drawing.options.positions,'section-a':[279,48]},
  pdfPageScales:{2:.9}}};
 await open(overflow);
 const overviewSection=await geometry(editor,'section-a');
 await field('pdf-preview-open').click();
 const firstPageBefore=await geometry(print,'front');
 const secondPageIssue=preview.locator('[data-pdf-issue=layout]').filter({hasText:/2 ページ.*断面図/});
 await secondPageIssue.click();
 assert.equal(await field('pdf-preview-page').inputValue(),'1');
 assert.equal(await print.locator('[data-overflow-outline]').count(),1);
 assert(await field('pdf-preview-save').isDisabled());
 const sectionBefore=await geometry(print,'section-a');
 await field('pdf-preview-fit-page').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.match(await geometry(print,'section-a'),/scale\(0\.9\)/);
 assert.notEqual(await geometry(print,'section-a'),sectionBefore);
 assert(await field('pdf-preview-save').isEnabled());
 await selectPage(1);
 assert.equal(await geometry(print,'front'),firstPageBefore);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 await field('pdf-preview-close').click();
 assert.equal(await geometry(editor,'section-a'),overviewSection);
 await field('undo').click();
 await field('pdf-preview-open').click();
 assert.equal(await secondPageIssue.count(),1);
 await field('pdf-preview-close').click();
 await field('pdf-placement').selectOption('auto');
 await field('pdf-preview-open').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.equal(await print.locator('svg').getAttribute('data-layout'),'compact');
 await field('pdf-preview-close').click();
 await field('close').click();

 await open({...drawing,dimensions:[]});
 const [autoColor,arrangeColor]=await Promise.all(['dimension-auto','dimension-arrange'].map(id=>
  field(id).evaluate(button=>getComputedStyle(button).backgroundColor)));
 assert.notEqual(autoColor,arrangeColor,'automatic dimension entry has a visible accent');
 await field('auto-unique-overall').check();
 await field('dimension-auto').click();
 await field('view-scales').locator('summary').click();
 await field('view-scales').locator('[data-view-scale=top]').selectOption('0.5');
 assert.match(await editor.locator('[data-sheet-scale]').textContent(),/縮尺は各図に記載/);
 await field('pdf-preview-open').click();
 assert.equal(await geometry(print,'top'),await geometry(editor,'top'));
 assert.match(await print.locator('[data-view=top]>text').textContent(),/SCALE 1:2/);
 assert.match(await print.locator('[data-view=front]>text').textContent(),/SCALE 1:1/);
 await field('pdf-preview-next').click();
 assert.equal(await geometry(print,'section-a'),await geometry(editor,'section-a'));
 assert.equal(await print.locator('[data-sheet-scale]').textContent(),'SCALE 1:1 / mm');
 assert.equal(await print.locator('[data-comment=true]').textContent(),'切断位置を確認');
 await field('pdf-preview-edit').click();
 assert.equal(await field('page-edit').inputValue(),'1');
 assert.equal(await editor.locator('[data-view=front]').count(),0);
 assert.match(await pagesNote.textContent(),/2 ページ目を編集中/);
 const beforeSection=await geometry(editor,'section-a');
 const beforeComment=await commentX(editor);
 const drag=async(locator,dx,dy)=>{
  const box=await locator.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});await page.mouse.up();
 };
 await drag(editor.locator('[data-view=section-a] > rect[fill=transparent]'),-26,6);
 await drag(editor.locator('[data-comment=true] text').first(),-20,17);
 const sectionAt=await geometry(editor,'section-a');
 const commentAt=await commentX(editor);
 assert.notEqual(sectionAt,beforeSection);
 assert.notEqual(commentAt,beforeComment);
 await field('undo').click();
 assert.equal(await commentX(editor),beforeComment);
 await field('redo').click();
 await field('page-edit').selectOption('0');
 assert.equal(await editor.locator('[data-view=section-a]').count(),0);
 const dimension=editor.locator('[data-dimension] text').first();
 const dimensionAnchor=async locator=>locator.evaluate(el=>[el.getAttribute('x'),el.getAttribute('y'),el.getAttribute('transform')]);
 const beforeDimension=await dimensionAnchor(dimension);
 await drag(dimension,13,16);
 const afterDimension=await dimensionAnchor(dimension);
 assert.notDeepEqual(afterDimension,beforeDimension);
 await field('pdf-preview-open').click();
 assert.deepEqual(await dimensionAnchor(print.locator('[data-dimension] text').first()),afterDimension);
 await field('pdf-preview-next').click();
 assert.equal(await geometry(print,'section-a'),sectionAt);
 assert.equal(await commentX(print),commentAt);
 const [pdf]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const bytes=await fs.readFile(await pdf.path());
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.match(bytes.toString('latin1'),/\/Count 2/);
 if(process.env.FORMA_TEST_PDF_DIR){
  const folder=process.env.FORMA_TEST_PDF_DIR;
  await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,'drawing-check.pdf'),bytes);
 }
 await field('pdf-preview-close').click();
 await field('close').click();
 const [saved]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const file=(await decodeProjectDocument(await fs.readFile(await saved.path(),'utf8'))).document;
 const overalls=file.drawing.dimensions.filter(d=>d.overall&&!d.hidden);
 assert.equal(overalls.length,3);
 assert.equal(file.drawing.options.uniqueOverallDimensions,true);
 assert.ok(file.drawing.options.pdfPositions['section-a']);
 assert.ok(file.drawing.options.pdfPositions.comment);
 assert.ok(file.drawing.dimensions.some(d=>d.pdfPlacement));
 await page.locator('#export').click();
 await page.locator('#export-format').selectOption('pdf');
 await page.locator('#export-confirm').click();
 await field('page-edit').waitFor();
 await field('close').click();

 await open({...drawing,dimensions:[width]});
 const scaleOn=async(host,view)=>Number((await geometry(host,view)).match(/scale\(([^)]+)\)/)[1]);
 await field('auto-layout').click();
 const automaticScale=Number(await field('scale').inputValue());
 assert(automaticScale>=.1);
 assert.equal(automaticScale*10,Math.round(automaticScale*10));
 await field('undo').click();
 await field('view-scales').evaluate(details=>details.open=true);
 const frontInput=field('view-scales').locator('[data-view-scale-input=front]');
 await frontInput.press('ArrowDown');
 assert.equal(await scaleOn(editor,'front'),.9);
 assert.match(await editor.locator('[data-view=front]>text').textContent(),/FRONT \/ SCALE 0\.9:1/);
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'60');
 await field('pdf-preview-open').click();
 assert.equal(await scaleOn(print,'front'),.9);
 assert.match(await print.locator('[data-view=front]>text').textContent(),/FRONT \/ SCALE 0\.9:1/);
 await field('pdf-preview-close').click();
 await field('undo').click();
 assert.equal(await scaleOn(editor,'front'),1);
 await field('scale-manual').fill('１：２．５');
 await field('scale-manual').press('Enter');
 assert.equal(await scaleOn(editor,'front'),.4);
 assert.equal(await field('scale').inputValue(),'0.4');
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'60');
 await field('scale-manual').press('ArrowUp');
 assert.equal(await scaleOn(editor,'front'),.5);
 await field('scale-manual').press('ArrowDown');
 assert.equal(await scaleOn(editor,'front'),.4);
 await field('view-scales').evaluate(details=>details.open=true);
 await frontInput.press('ArrowUp');
 assert.equal(await scaleOn(editor,'front'),.5);
 assert.equal(await scaleOn(editor,'top'),.4);
 await field('undo').click();
 assert.equal(await scaleOn(editor,'front'),.4);
 const resize=name=>editor.locator('[data-view-resize="'+name+'"]');
 const beforeSmallDrag=await geometry(editor,'front');
 await drag(resize('front'),-2,-1);
 assert.equal(await geometry(editor,'front'),beforeSmallDrag);
 await drag(resize('front'),-12,-5);
 const resizedProjection=await scaleOn(editor,'front');
 assert.ok(resizedProjection<.4);
 assert.equal(resizedProjection*10,Math.round(resizedProjection*10));
 assert.equal(await scaleOn(editor,'top'),resizedProjection);
 await field('undo').click();
 assert.equal(await scaleOn(editor,'front'),.4);

 await field('pdf-placement').selectOption('auto');
 await field('page-scales').evaluate(details=>details.open=true);
 const pageScale=number=>field('page-scales').locator('[data-pdf-page-scale="'+number+'"]');
 await pageScale(1).fill('7');await pageScale(1).press('Enter');
 assert.equal(await scaleOn(editor,'front'),7);
 await field('pdf-preview-open').click();
 assert.ok(await preview.locator('[data-pdf-issue=layout]').count());
 assert.ok(await field('pdf-preview-save').isDisabled());
 const oversized=await geometry(print,'front');
 await field('pdf-preview-fit-page').click();
 assert.match(await field('pdf-preview-status').textContent(),/縮尺を保ったまま収まりません/);
 assert.equal(await geometry(print,'front'),oversized);
 assert.ok(await field('pdf-preview-save').isDisabled());
 await field('pdf-preview-close').click();
 for(const [number,value,view,scale] of [[1,'1:2','front',.5],[2,'0.375','section-a',.375]]){
  await pageScale(number).fill(value);await pageScale(number).press('Enter');
  assert.equal(await field('page-edit').inputValue(),String(number-1));
  assert.equal(await scaleOn(editor,view),scale);
 }
 await pageScale(2).press('ArrowUp');
 assert.equal(await scaleOn(editor,'section-a'),.4);
 await field('undo').click();
 assert.equal(await scaleOn(editor,'section-a'),.375);
 const segment=await geometry(editor,'section-a');
 await drag(resize('section-a'),-10,-6);
 const sectionScale=await scaleOn(editor,'section-a');
 assert.ok(sectionScale<.375&&sectionScale>0);
 assert.equal(sectionScale*10,Math.round(sectionScale*10));
 const place=t=>t.slice(0,t.indexOf('scale('));
 assert.equal(place(await geometry(editor,'section-a')),place(segment));
 await field('undo').click();assert.equal(await scaleOn(editor,'section-a'),.375);
 await field('redo').click();assert.equal(await scaleOn(editor,'section-a'),sectionScale);
 await field('pdf-preview-open').click();
 assert.equal(await scaleOn(print,'front'),.5);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 await field('pdf-preview-next').click();
 assert.equal(await scaleOn(print,'section-a'),sectionScale);
 assert.equal(await print.locator('[data-view-resize]').count(),0);
 assert.equal(await print.locator('[data-comment=true]').textContent(),'切断位置を確認');
 const [resizedPDF]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const resizedBytes=await fs.readFile(await resizedPDF.path());
 assert.match(resizedBytes.toString('latin1'),/\/Count 2/);
 if(process.env.FORMA_TEST_PDF_DIR){
  const folder=process.env.FORMA_TEST_PDF_DIR;
  await fs.writeFile(path.join(folder,'drawing-page-scales.pdf'),resizedBytes);
  await fs.writeFile(path.join(folder,'drawing-page-scales.json'),JSON.stringify({front:.5,section:sectionScale}));
 }
 await field('pdf-preview-close').click();
 await field('close').click();
 const [scaledProject]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const scaled=(await decodeProjectDocument(await fs.readFile(await scaledProject.path(),'utf8'))).document.drawing;
 assert.equal(scaled.scale,.4);
 assert.deepEqual(scaled.options.pdfPageScales,{1:.5,2:.375});
 assert.equal(scaled.options.pdfViewScales['section-a'],sectionScale);
 await open(scaled);
 await field('page-edit').selectOption('1');
 assert.equal(await scaleOn(editor,'section-a'),sectionScale);
 await field('page-edit').selectOption('-1');
 assert.equal(await scaleOn(editor,'section-a'),.4);
 await field('close').click();

 await open({...drawing,dimensions:[width],comment:'加工面を確認',options:{...drawing.options,pdfLayout:'multi',
  positions:{...drawing.options.positions,comment:[192,181]},leaders:[
    {id:'leader-finish',view:'front',anchor:[15,-10],at:[18,17],text:'バリ取り'},
  ]}});
 await field('pdf-preview-open').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.drawing-pdf-page-thumb img')].every(image=>image.naturalWidth>0));
 assert.equal(await pdfPage(1).locator('[data-page-item=front]').count(),1);
 assert.equal(await pdfPage(2).locator('[data-page-item=section-a]').count(),1);
 await pdfPage(1).locator('[data-page-item=front]').dragTo(pdfPage(2).locator('.drawing-pdf-page-thumb'));
 assert.equal(await field('pdf-preview-page').inputValue(),'1');
 assert.equal(await pdfPage(1).locator('[data-page-item=front]').count(),0);
 assert.equal(await pdfPage(2).locator('[data-page-item=front]').count(),1);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 assert.equal(await print.locator('[data-leader] text').textContent(),'バリ取り');
 await pdfPage(1).locator('[data-page-item=comment]').click();
 const move=preview.locator('.drawing-pdf-page-move');
 await move.locator('select').selectOption('1');
 await move.getByRole('button',{name:'移動',exact:true}).click();
 assert.equal(await pdfPage(2).locator('[data-page-item=comment]').count(),1);
 assert.equal(await print.locator('[data-comment=true]').textContent(),'加工面を確認');
 await preview.locator('[data-pdf-issue=layout]').filter({hasText:/2 ページ.*表題欄と重なり/}).click();
 assert.equal(await print.locator('[data-overflow-outline]').count(),1);
 assert(await print.locator('[data-comment=true]').evaluate(item=>item===item.parentElement.lastElementChild));
 if(process.env.FORMA_TEST_PDF_DIR){
  await page.screenshot({path:path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-page-issue.png')});
 }
 await field('pdf-preview-fit-page').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.equal(await print.locator('[data-overflow-outline]').count(),0);
 assert.equal(await scaleOn(print,'front'),1);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 await selectPage(1);
 assert.equal(await print.locator('[data-view=front],[data-dimension],[data-leader],[data-comment]').count(),0);
 const [assignedPDF]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const assignedBytes=await fs.readFile(await assignedPDF.path());
 assert.match(assignedBytes.toString('latin1'),/\/Count 2/);
 if(process.env.FORMA_TEST_PDF_DIR){
  await fs.writeFile(path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-page-assignment.pdf'),assignedBytes);
 }
 await field('pdf-preview-close').click();
 assert.equal(await field('pdf-layout').inputValue(),'manual');
 await field('close').click();
 const [assignedProject]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const assigned=(await decodeProjectDocument(await fs.readFile(await assignedProject.path(),'utf8'))).document.drawing;
 assert.deepEqual(assigned.options.pageAssignments,{pageCount:2,views:{top:1,front:2,right:1,'section-a':2},comments:{comment:2}});
 await open(assigned);
 await field('pdf-preview-open').click();
 await selectPage(2);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 assert.equal(await print.locator('[data-comment=true]').textContent(),'加工面を確認');
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 await field('pdf-preview-close').click();
 await field('pdf-layout').selectOption('');
 await field('pdf-preview-open').click();
 assert(await field('pdf-preview-pages').locator('.drawing-pdf-thumbnails').isHidden());
 assert(await field('pdf-preview-save').isDisabled());
 await field('pdf-preview-fit-page').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.equal(await scaleOn(print,'front'),1);
 assert(await field('pdf-preview-save').isEnabled());
 const singleFront=await geometry(print,'front');
 await field('pdf-preview-add-page').click();
 assert.match(await pdfPage(2).textContent(),/空白ページ/);
 assert.equal(await field('pdf-preview-page').inputValue(),'1');
 await selectPage(1);
 assert.equal(await geometry(print,'front'),singleFront);
 assert(await field('pdf-preview-remove-page').isHidden());
 await selectPage(2);
 await field('pdf-preview-remove-page').click();
 assert(await field('pdf-preview-pages').locator('.drawing-pdf-thumbnails').isHidden());
 assert.equal(await geometry(print,'front'),singleFront);
 await field('pdf-preview-close').click();
 await field('close').click();

 const withPageScales={...drawing,dimensions:[width],options:{...drawing.options,pdfLayout:'multi',
   pdfPageScales:{1:.9,2:.5}}};
 await open(withPageScales);
 const inlineBadge=name=>page.locator('[data-inline-view-scale="'+name+'"]');
 const inlineInput=page.locator('[data-inline-scale-input]');
 const inlineStep=direction=>page.locator('[data-inline-scale-step="'+direction+'"]');
 assert.equal(await inlineBadge('front').textContent(),'1:1');
 await inlineBadge('front').click();
 await inlineInput.fill('1:2.5');await inlineInput.press('Enter');
 assert.equal(await scaleOn(editor,'front'),.4);
 assert.equal(await scaleOn(editor,'top'),.4);
 await inlineStep(1).click();
 assert.equal(await scaleOn(editor,'front'),.5);
 await inlineStep(-1).click();
 assert.equal(await scaleOn(editor,'front'),.4);
 await inlineInput.fill('0.8');await inlineInput.press('Escape');
 assert(await inlineInput.isHidden());
 assert(await field('dialog').isVisible());
 assert.equal(await scaleOn(editor,'front'),.4);
 assert.equal(await inlineBadge('front').textContent(),'1:2.5');
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'60');
 await field('undo').click();assert.equal(await scaleOn(editor,'front'),.5);
 await field('redo').click();assert.equal(await scaleOn(editor,'front'),.4);
 await field('page-edit').selectOption('1');
 assert.equal(await inlineBadge('section-a').textContent(),'1:2');
 const inlineSection=await geometry(editor,'section-a');
 await inlineBadge('section-a').click();await inlineStep(1).click();
 assert.equal(await scaleOn(editor,'section-a'),.6);
 assert.equal(place(await geometry(editor,'section-a')),place(inlineSection));
 if(process.env.FORMA_TEST_PDF_DIR){
  await page.screenshot({path:path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-inline-scale-edit.png')});
 }
 await field('page-edit').selectOption('-1');
 assert.equal(await scaleOn(editor,'section-a'),.4);

 await field('pdf-preview-open').click();
 assert.equal(await scaleOn(print,'front'),.9);
 await field('pdf-preview-add-page').click();
 assert.match(await pdfPage(3).textContent(),/空白ページ/);
 await page.waitForFunction(()=>[...document.querySelectorAll('.drawing-pdf-page-thumb img')].every(image=>image.naturalWidth>0));
 if(process.env.FORMA_TEST_PDF_DIR){
  await page.screenshot({path:path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-page-order-edit.png')});
 }
 await pdfPage(2).locator('.drawing-pdf-page-thumb').dragTo(pdfPage(1).locator('.drawing-pdf-page-thumb'));
 assert.equal(await field('pdf-preview-page').inputValue(),'0');
 assert.equal(await scaleOn(print,'section-a'),.6);
 assert.equal(await pdfPage(1).locator('[data-page-item=section-a]').count(),1);
 assert.equal(await pdfPage(2).locator('[data-page-item=front]').count(),1);
 await selectPage(2);assert.equal(await scaleOn(print,'front'),.9);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'60');
 await field('pdf-preview-page-earlier').click();
 assert.equal(await scaleOn(print,'front'),.9);
 await field('pdf-preview-page-later').click();
 assert.equal(await field('pdf-preview-page').inputValue(),'1');
 await selectPage(3);
 await field('pdf-preview-page-earlier').click();
 assert.match(await pdfPage(2).textContent(),/空白ページ/);
 await field('pdf-preview-remove-page').click();
 assert.equal(await pdfPage(3).count(),0);
 assert.equal(await scaleOn(print,'front'),.9);
 const [orderedPDF]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const orderedBytes=await fs.readFile(await orderedPDF.path());
 assert.match(orderedBytes.toString('latin1'),/\/Count 2/);
 if(process.env.FORMA_TEST_PDF_DIR){
  await fs.writeFile(path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-page-reordered.pdf'),orderedBytes);
 }
 await field('pdf-preview-close').click();
 await field('undo').click();
 await field('pdf-preview-open').click();
 assert.match(await pdfPage(2).textContent(),/空白ページ/);
 await field('pdf-preview-close').click();
 await field('redo').click();
 await field('close').click();
 const [orderedProject]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const ordered=(await decodeProjectDocument(await fs.readFile(await orderedProject.path(),'utf8'))).document.drawing;
 assert.deepEqual(ordered.options.pdfPageScales,{1:.5,2:.9});
 assert.deepEqual(ordered.options.pdfViewScales,{'section-a':.6});
 assert.deepEqual(ordered.options.pageAssignments,{pageCount:2,views:{top:2,front:2,right:2,'section-a':1},comments:{comment:2}});
 await open(ordered);
 await field('pdf-preview-open').click();
 assert.equal(await scaleOn(print,'section-a'),.6);
 await selectPage(2);assert.equal(await scaleOn(print,'front'),.9);
 await field('pdf-preview-close').click();await field('close').click();

 const isoDrawing={...drawing,dimensions:[],comment:'',options:{...drawing.options,viewSelection:[],isoMode:'full',
  positions:{iso:[65,65]},sections:[],pageAssignments:{pageCount:2,views:{iso:2},comments:{}}}};
 await open(isoDrawing,'iso');
 assert(await field('dimension-add').isDisabled());
 await field('dimension-kind').selectOption('aligned');
 assert.match(await field('dimension-hint').textContent(),/俯瞰図.*実寸/);
 await field('dimension-add').click();
 const isoMarker=point=>editor.locator('[data-snap-view=iso][data-snap-point="'+JSON.stringify(point)+'"]');
 const isoTop=isoMarker([0,-16.32993]),isoBottom=isoMarker([0,0]);
 await isoTop.hover();
 assert.equal(await isoTop.getAttribute('data-dimension-hover'),'point');
 await isoTop.click();await isoBottom.click();
 assert.match(await field('status').textContent(),/20 mm/);
 const localPoint=(host,view,point)=>host.locator('[data-view="'+view+'"] > g[transform]').evaluate((el,[x,y])=>{
  const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return [p.x,p.y];
 },point);
 await page.mouse.click(...await localPoint(editor,'iso',[-10,-8]));
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'20');
 await field('scale-manual').fill('1:2');await field('scale-manual').press('Enter');
 assert.equal(await scaleOn(editor,'iso'),.5);
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'20');
 await field('pdf-preview-open').click();
 assert.equal(await print.locator('[data-dimension]').count(),0);
 await selectPage(2);
 assert.equal(await print.locator('[data-dimension] text').textContent(),'20');
 const [isoFile]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const isoBytes=await fs.readFile(await isoFile.path());
 assert.match(isoBytes.toString('latin1'),/\/Count 2/);
 if(process.env.FORMA_TEST_PDF_DIR)await fs.writeFile(path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-iso-dimension.pdf'),isoBytes);
 await field('pdf-preview-close').click();await field('close').click();
 const [isoProject]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const isoReloaded=(await decodeProjectDocument(await fs.readFile(await isoProject.path(),'utf8'))).document.drawing;
 assert.deepEqual(isoReloaded.dimensions[0].modelA,[0,0,20]);
 assert.deepEqual(isoReloaded.dimensions[0].modelB,[0,0,0]);
 await open(isoReloaded,'iso');
 assert.equal(await editor.locator('[data-dimension] text').textContent(),'20');
 const isoOptions=field('auto-dimension-views');
 await isoOptions.locator('summary').click();
 const isoOutline=isoOptions.locator('[data-auto-dimension-view=iso] input');
 assert(await isoOutline.isChecked());
 await isoOutline.uncheck();
 await field('dimension-auto').click();
 assert.deepEqual(await editor.locator('[data-dimension] text').allTextContents(),['20']);
 await isoOutline.check();
 await field('dimension-auto').click();
 assert.deepEqual(await editor.locator('[data-dimension] text').allTextContents(),['20','60','40']);
 await field('dimension-auto').click();
 assert.equal(await editor.locator('[data-dimension]').count(),3);
 await field('pdf-preview-open').click();
 assert.equal(await print.locator('[data-dimension]').count(),0);
 await selectPage(2);
 assert.deepEqual(await print.locator('[data-dimension] text').allTextContents(),['20','60','40']);
 await field('pdf-preview-close').click();
 await field('close').click();

 const coincident={view:'front',kind:'horizontal',a:[0,-20],b:[60,-20],at:[30,-20],lineColor:'#df2562'};
 await open({...drawing,dimensions:[coincident],comment:'',options:{...drawing.options,viewSelection:['front'],
  viewBackground:'#c4e3ee',sections:[],positions:{front:[45,68]},pdfLayout:undefined,pageAssignments:undefined}});
 const overlapPoint=await localPoint(editor,'front',[30,-20]);
 assert.equal(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('[data-view]')?.dataset.view,overlapPoint),'front');
 await page.mouse.click(...overlapPoint);
 assert.equal(await editor.locator('[data-dimension][data-edit-selected]').count(),1);
 await field('pdf-preview-open').click();
 const colors=await print.locator('svg').evaluate(async svg=>{
  const copy=svg.cloneNode(true),[, ,width,height]=svg.getAttribute('viewBox').split(' ').map(Number),density=8;
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(width*density);canvas.height=Math.ceil(height*density);
  copy.setAttribute('width',canvas.width);copy.setAttribute('height',canvas.height);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
  try{
   const image=new Image();image.src=url;await image.decode();
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   const label=copy.querySelector('[data-dimension] > rect');
   return [57,Number(label.getAttribute('x'))+.8].map(x=>
    [...ctx.getImageData(Math.floor(x*density),68*density,1,1).data].slice(0,3));
  }finally{URL.revokeObjectURL(url);}
 });
 for(const rgb of colors)assert.ok(Math.max(...rgb)<40,'model stroke stays dark over the dimension line and label background');
 const [layeredFile]=await Promise.all([page.waitForEvent('download'),field('pdf-preview-save').click()]);
 const layeredBytes=await fs.readFile(await layeredFile.path());
 assert.match(layeredBytes.toString('latin1'),/\/Count 1/);
 if(process.env.FORMA_TEST_PDF_DIR)await fs.writeFile(path.join(process.env.FORMA_TEST_PDF_DIR,'drawing-outline-over-dimension.pdf'),layeredBytes);
 await field('pdf-preview-close').click();
 await field('close').click();

 await open(isoDrawing,'iso');
 const colorChoices={'default-line-color':'#287e56','default-text-color':'#8f2048','comment-color':'#454c9c',
  'preview-background':'#fcf1cd','view-background':'#c8e9e9'};
 for(const [id,color] of Object.entries(colorChoices))await field(id).fill(color);
 await field('print-palette').selectOption('light');
 await field('dimension-auto').click();
 assert.deepEqual(await editor.locator('[data-dimension] text').allTextContents(),['60','40','20']);
 assert.equal(await editor.locator('[data-dimension]').first().getAttribute('stroke'),colorChoices['default-line-color']);
 assert.equal(await editor.locator('[data-dimension] text').first().getAttribute('fill'),colorChoices['default-text-color']);
 await field('close').click();

 await page.reload();
 await page.waitForFunction(()=>typeof document.getElementById('file')?.onchange==='function');
 await open(drawing);
 assert.equal(await field('default-line-color').inputValue(),'#24455b');
 assert.equal(await field('view-background').inputValue(),'#ffffff');
 await field('close').click();
 await open(null);
 for(const [id,color] of Object.entries(colorChoices))assert.equal(await field(id).inputValue(),color,id);
 assert.equal(await field('print-palette').inputValue(),'light');
 assert(await editor.locator('[data-view=iso]').isVisible());
 await field('dimension-auto').click();
 assert.deepEqual((await editor.locator('[data-dimension] text').allTextContents()).sort(),
  ['20','20','20','40','40','40','60','60','60']);
 await field('default-colors-reset').click();
 await field('close').click();
 await open(null);
 assert.equal(await field('default-line-color').inputValue(),'#24455b');
 assert.equal(await field('default-text-color').inputValue(),'#24455b');
 assert.equal(await field('comment-color').inputValue(),colorChoices['comment-color']);
 const link=field('link-projections');
 const viewRect=name=>editor.locator('[data-view="'+name+'"] > rect[fill=transparent]');
 const viewBox=name=>viewRect(name).evaluate(rect=>['x','y','width','height'].map(key=>Number(rect.getAttribute(key))));
 const viewAt=async(host,name)=>(await geometry(host,name)).match(/^translate\(([^)]+)\)/)[1].split(' ').map(Number);
 const closeTo=(a,b)=>assert.ok(Math.abs(a-b)<.05,`${a} versus ${b}`);
 const aligned=async()=>{
  const [top,front,right]=await Promise.all(['top','front','right'].map(viewBox));
  closeTo(top[0]+top[2]/2,front[0]+front[2]/2);
  closeTo(right[1]+right[3]/2,front[1]+front[3]/2);
  assert(top[1]+top[3]<front[1]+7&&right[0]>front[0]+front[2]);
 };
 const dragView=(id,dx,dy)=>drag(editor.locator('[data-view="'+id+'"] > text').first(),dx,dy);
 const projectionNames=['front','top','right'];
 const drawingViews=[...projectionNames,'iso'];
 const transforms=(names=drawingViews)=>Promise.all(names.map(name=>geometry(editor,name)));
 assert.equal(await link.isChecked(),false);
 const [isoX]=await viewBox('iso');
 for(const view of ['top','front','right']){
  const [x,,width]=await viewBox(view);
  assert(isoX>x+width);
 }
 const initialViews=await transforms();
 assert((await scaleOn(editor,'iso'))<(await scaleOn(editor,'front')));
 await field('dimension-auto').click();
 assert.equal(await editor.locator('[data-dimension]').count(),9);
 assert.deepEqual(await transforms(),initialViews);
 await field('dimension-clear').click();
 const [manualColor,automaticColor]=await Promise.all(['dimension-add','dimension-auto'].map(id=>
  field(id).evaluate(button=>getComputedStyle(button).backgroundColor)));
 assert.equal(manualColor,'rgb(239, 195, 106)');
 assert.notEqual(manualColor,automaticColor);
 await link.check();
 await aligned();
 assert.equal(await editor.locator('[data-overflow-outline]').count(),0);
 const isoPosition=await geometry(editor,'iso');
 const firstFront=await viewAt(editor,'front');
 await field('snap').uncheck();
 const grip=await editor.locator('[data-view=top] > text').first().boundingBox();
 const [grabX,grabY]=[grip.x+grip.width/2,grip.y+grip.height/2];
 await page.mouse.move(grabX,grabY);await page.mouse.down();
 await page.mouse.move(grabX-16,grabY,{steps:4});
 const verticalGuide=editor.locator('[data-projection-guide="0"]'),horizontalGuide=editor.locator('[data-projection-guide="1"]');
 const [guideX,guideY]=await viewAt(editor,'front'),guideScale=await scaleOn(editor,'front');
 closeTo(Number(await verticalGuide.getAttribute('x1')),guideX+60*guideScale/2);
 closeTo(Number(await horizontalGuide.getAttribute('y1')),guideY+20*guideScale/2);
 await page.mouse.up();
 assert.equal(await editor.locator('[data-projection-guide]').count(),0);
 const secondFront=await viewAt(editor,'front');
 assert(secondFront[0]<firstFront[0]);
 closeTo(secondFront[1],firstFront[1]);
 await aligned();
 await dragView('right',0,15);
 const thirdFront=await viewAt(editor,'front');
 closeTo(thirdFront[0],secondFront[0]);
 assert(thirdFront[1]>secondFront[1]);
 await aligned();
 await dragView('front',-10,10);
 const movedFront=await viewAt(editor,'front');
 assert(movedFront[0]<thirdFront[0]&&movedFront[1]>thirdFront[1]);
 await aligned();
 assert.equal(await geometry(editor,'iso'),isoPosition);
 await field('undo').click();
 assert.deepEqual(await viewAt(editor,'front'),thirdFront);
 await field('redo').click();
 assert.deepEqual(await viewAt(editor,'front'),movedFront);
 await field('close').click();
 const [linkSave]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const linkDrawing=(await decodeProjectDocument(await fs.readFile(await linkSave.path(),'utf8'))).document.drawing;
 assert.equal(linkDrawing.options.linkedProjections,true);
 await open(linkDrawing);
 assert(await link.isChecked());
 await aligned();
 await link.uncheck();
 await dragView('top',16,0);
 assert.deepEqual(await viewAt(editor,'front'),movedFront);
 assert.notEqual((await viewAt(editor,'top'))[0],movedFront[0]);
 await field('close').click();

 await open({...linkDrawing,options:{...linkDrawing.options,pdfLayout:'manual',pdfPlacement:'keep',
  pageAssignments:{pageCount:2,views:{right:2,iso:2},comments:{}}}});
 await field('page-edit').selectOption('1');
 const otherPageRight=await geometry(editor,'right');
 await field('page-edit').selectOption('0');
 assert(!(await editor.locator('[data-view=right]').count()));
 const pageFront=await viewAt(editor,'front');
 await dragView('top',-14,0);
 const adjustedFront=await viewAt(editor,'front');
 assert(adjustedFront[0]<pageFront[0]);
 closeTo((await viewAt(editor,'top'))[0],adjustedFront[0]);
 await field('page-edit').selectOption('1');
 assert.equal(await geometry(editor,'right'),otherPageRight);
 await field('page-edit').selectOption('-1');
 assert.deepEqual(await viewAt(editor,'front'),movedFront);
 await field('close').click();

 const crowded={...drawing,comment:'',dimensions:[],scale:4.75,options:{...drawing.options,layout:'compact',
  pdfLayout:undefined,sections:[],viewSelection:['front'],positions:{front:[6,45]}}};
 await open(crowded);
 const tightView=await geometry(editor,'front');
 assert.equal(await editor.locator('[data-overflow-outline]').count(),0);
 await field('dimension-auto').click();
 assert.equal(await geometry(editor,'front'),tightView);
 assert.equal(await editor.locator('[data-view][data-drawing-overflow]').count(),0);
 assert.ok(await editor.locator('[data-dimension][data-drawing-overflow]').count()>0);
 assert.match(await field('status').textContent(),/はみ出した寸法.*赤枠/);
 await field('close').click();

 const scaleCase={...drawing,comment:'',dimensions:[],options:{...drawing.options,layout:'compact',isoMode:'full',
  pdfLayout:undefined,sections:[],linkedProjections:true,positions:{top:[60,40],front:[60,95],right:[145,95],iso:[207,65]},
  viewScales:{front:.8,top:.65,right:.5,iso:.55}}};
 await open(scaleCase);
 const scaleLink=field('link-scales');
 const projectionScales=()=>Promise.all(projectionNames.map(name=>scaleOn(editor,name)));
 assert.deepEqual(await projectionScales(),[.8,.65,.5]);
 await scaleLink.check();
 assert.deepEqual(await projectionScales(),[.8,.8,.8]);
 await field('view-scales').evaluate(details=>details.open=true);
 const scaleInputFor=name=>field('view-scales').locator('[data-view-scale-input="'+name+'"]');
 await scaleInputFor('top').fill('0.7');
 await scaleInputFor('top').press('Enter');
 assert.deepEqual(await projectionScales(),[.7,.7,.7]);
 await inlineBadge('right').click();
 await inlineInput.press('ArrowDown');
 assert.deepEqual(await projectionScales(),[.6,.6,.6]);
 await inlineInput.press('Escape');
 await drag(resize('front'),14,5);
 const [resizedFront,resizedTop,resizedRight]=await projectionScales();
 assert(resizedFront>.6&&resizedFront===resizedTop&&resizedFront===resizedRight);
 assert.equal(await scaleOn(editor,'iso'),.55);
 await field('undo').click();
 assert.deepEqual(await projectionScales(),[.6,.6,.6]);
 await field('redo').click();
 assert.deepEqual(await projectionScales(),[resizedFront,resizedFront,resizedFront]);
 await field('close').click();
 const [scaleSave]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const savedScales=(await decodeProjectDocument(await fs.readFile(await scaleSave.path(),'utf8'))).document.drawing;
 assert.equal(savedScales.options.linkedProjectionScales,true);
 await open({...savedScales,options:{...savedScales.options,pdfLayout:'manual',pdfPlacement:'auto',
  pageAssignments:{pageCount:2,views:{right:2,iso:2},comments:{}}}});
 assert(await scaleLink.isChecked());
 await field('page-edit').selectOption('1');
 const pageTwo=await transforms(['right','iso']);
 await field('page-edit').selectOption('0');
 const beforeAutoOnPage=await transforms(['front','top']);
 await field('dimension-auto').click();
 assert.equal(await editor.locator('[data-dimension]').count(),4);
 assert.deepEqual(await transforms(['front','top']),beforeAutoOnPage);
 await field('view-scales').evaluate(details=>details.open=true);
 await scaleInputFor('top').fill('0.4');
 await scaleInputFor('top').press('Enter');
 assert.equal(await scaleOn(editor,'front'),.4);
 assert.equal(await scaleOn(editor,'top'),.4);
 await field('page-edit').selectOption('1');
 assert.deepEqual(await transforms(['right','iso']),pageTwo);
 await field('page-edit').selectOption('-1');
 assert.deepEqual(await projectionScales(),[resizedFront,resizedFront,resizedFront]);
 assert.deepEqual(errors,[]);
 console.log('PASS fixed view positions on auto-dimension, linked scales, right-column ISO and projection drag guides');
}finally{await browser?.close();server.close();}
