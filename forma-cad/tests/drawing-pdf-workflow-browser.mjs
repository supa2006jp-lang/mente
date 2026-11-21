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

 async function open(state){
  const project={format:'forma-cad',version:1,features,drawing:state};
  await page.locator('#file').setInputFiles({name:'drawing-pdf-check.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.locator('#project-preview-open').click();
  await field('tool').click();
  await editor.locator('[data-view=front]').waitFor();
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
 assert(await field('pdf-preview-pages').isHidden());
 assert(await field('pdf-preview-save').isDisabled());
 await field('pdf-preview-fit-page').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.equal(await scaleOn(print,'front'),1);
 assert(await field('pdf-preview-save').isEnabled());
 assert.deepEqual(errors,[]);
 console.log('PASS page thumbnails, reassignment with dimensions and leaders, isolated fixed-scale fit, PDF export and project reload');
}finally{await browser?.close();server.close();}
