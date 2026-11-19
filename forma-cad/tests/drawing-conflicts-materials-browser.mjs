import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {drawingSignature} from '../src/drawing-state.js';
import {drawingMaterialsKey} from '../src/drawing-materials.js';
import {decodeProjectDocument} from '../src/project-codec.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const block=R.makeBox([0,0,0],[50,50,20]),shape=block.fillet(2,f=>f.inDirection('Z'));
const project={
 format:'forma-cad',version:1,
 features:[{kind:'cadop',id:'part',name:'R2 試験片',remove:[],
  outputs:[{id:'part',brep:shape.serialize(),...shape.mesh({tolerance:.1,angularTolerance:.2})}]}],
};
shape.delete();block.delete();
const drawing={
 version:1,signature:drawingSignature(project.features),targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',
 dimensions:[
  {view:'top',kind:'horizontal',a:[0,0],b:[50,0],at:[25,8],overall:'tophorizontal',pinned:true},
  {view:'top',kind:'radius',center:[48,-2],radius:2,arcPoint:[48+Math.SQRT2,-2+Math.SQRT2],at:[50.5,7.6],automatic:true},
 ],
 options:{name:'R2 試験片',material:'',date:'',paper:'A4',orientation:'landscape',frame:true,layout:'compact',
  viewSelection:['top'],isoMode:'hidden',positions:{top:[40,30]}},
};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const file=path.resolve('dist','.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(path.resolve('dist')+path.sep))throw Error();
  const contents=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(contents);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1200},acceptDownloads:true}),errors=[];
 page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 const field=id=>page.locator('#drawing-'+id);
 async function savePDF(){
  const download=page.waitForEvent('download');
  await field('pdf').click();
  const needsReview=await field('pdf-preview').isVisible();
  if(needsReview){
   assert.match(await field('pdf-preview-check-summary').textContent(),/出力前チェック/);
   await field('pdf-preview-save').click();
  }
  const bytes=await fs.readFile(await(await download).path());
  if(needsReview)await field('pdf-preview-close').click();
  return bytes;
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();
 async function open(name,document){
  await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});
  await page.locator('#project-preview-open').click();
  await page.waitForFunction(()=>!window.document.getElementById('project-load-preview').open);
  await field('tool').click();
  await field('preview').locator('svg').waitFor().catch(async error=>{
   const status=await field('status').textContent();
   const appStatus=await page.locator('#status').textContent();
   throw new Error(name+' — '+status+' / '+appStatus,{cause:error});
  });
 }
 await open('r2-collision.forma.json',{...project,drawing});
 const section=field('conflicts'),row=index=>section.locator('[data-dimension-conflict="'+index+'"]');
 const label=index=>field('preview').locator('[data-dimension="'+index+'"] text');
 assert(await field('layout-mode').isChecked());
 await label(1).click();
 assert(await field('editor').isVisible());
 await field('dimension-add').click();
 assert.equal(await field('preview').locator('[data-view=top]>rect').count(),0);
 await field('dimension-cancel').click();
 assert(await field('layout-mode').isChecked());
 assert.equal(await field('preview').locator('[data-view=top]>rect').count(),1);
 await field('layout-mode').uncheck();
 await field('center-add').click();
 await field('dimension-cancel').click();
 assert(!(await field('layout-mode').isChecked()));
 await field('layout-mode').check();
 const initially=await label(1).getAttribute('x'),fixed=await label(0).getAttribute('y');
 await section.locator('summary').click();
 assert.match(await row(1).textContent(),/R2.*文字と矢印/);
 assert(await row(0).getByRole('button',{name:'この寸法だけ再配置'}).isDisabled());
 await row(1).getByRole('button',{name:/文字と矢印/}).click();
 assert.notEqual(await field('zoom-percent').textContent(),'100%');
 assert.equal(await field('preview').locator('[data-focused-conflict]').count(),1);
 await row(1).getByRole('button',{name:'この寸法だけ再配置'}).click();
 assert(await section.isHidden());
 assert.notEqual(await label(1).getAttribute('x'),initially);
 assert.equal(await label(0).getAttribute('y'),fixed);
 await field('undo').click();
 assert.equal(await label(1).getAttribute('x'),initially);
 assert(await section.isVisible());
 await field('redo').click();
 assert(await section.isHidden());
 await field('zoom-fit').click();
 await label(0).click();
 await field('dimension-pin').uncheck();
 await field('layout-mode').check();
 const textPoint=async()=>Promise.all(['x','y'].map(key=>label(0).getAttribute(key)));
 const original=await textPoint();
 async function dragLabel(dx,dy){
  await label(0).scrollIntoViewIfNeeded();
  const box=await label(0).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up();
 }
 await dragLabel(44,32);
 const oblique=await textPoint();
 assert(+oblique[0]>+original[0]&&+oblique[1]>+original[1]);
 assert.equal(await label(0).textContent(),'50');
 const path=field('preview').locator('[data-dimension="0"] path').first();
 const [ax,ay,bx,by]=(await path.getAttribute('d')).match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number);
 assert.equal(ax,40);assert.equal(ay,80);
 assert(bx>ax&&by>ay,'the extension leaves the original measurement point diagonally');
 await field('undo').click();
 assert.deepEqual(await textPoint(),original);
 await field('redo').click();
 assert.deepEqual(await textPoint(),oblique);
 await page.keyboard.down('Shift');await dragLabel(44,20);await page.keyboard.up('Shift');
 const constrained=await textPoint();
 assert.equal(constrained[0],oblique[0]);assert(+constrained[1]>+oblique[1]);
 await field('comment').fill('LOWER LEFT NOTE');await field('comment').press('Tab');
 const preview=field('preview').locator('svg'),note=preview.locator('[data-comment]');
 await preview.scrollIntoViewIfNeeded();
 const [from,to]=await note.evaluate(node=>{
  const box=node.getBBox(),svg=node.ownerSVGElement,matrix=svg.getScreenCTM();
  return [[box.x+box.width/2,box.y+box.height/2],[30,204.5-box.height/2]].map(point=>{
   const p=new DOMPoint(...point).matrixTransform(matrix);return [p.x,p.y];
  });
 });
 await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps:6});
 assert.equal(await preview.locator('[data-placement-guide="1"]').getAttribute('y1'),'205');
 await page.mouse.up();
 assert.equal(await preview.locator('[data-placement-guide]').count(),0);
 const noteBounds=()=>note.evaluate(node=>{
  const {x,y,width,height}=node.getBBox();return {x,y,width,height};
 });
 const lowerLeft=await noteBounds();
 assert(lowerLeft.y>178&&Math.abs(lowerLeft.y+lowerLeft.height-205)<.01&&lowerLeft.x+lowerLeft.width<132);
 assert(!(await field('svg').isDisabled()));
 assert(!(await field('pdf').isDisabled()));
 const svgDownload=page.waitForEvent('download');await field('svg').click();
 assert.match(await fs.readFile(await(await svgDownload).path(),'utf8'),/>LOWER LEFT NOTE<\/text>/);
 assert.equal((await savePDF()).subarray(0,5).toString(),'%PDF-');
 await field('close').click();
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const file=await fs.readFile(await(await download).path(),'utf8');
 const saved=(await decodeProjectDocument(file)).document;
 assert(saved.drawing.dimensions[0].alongOffset>0);
 assert.deepEqual(saved.drawing.dimensions[0].a,drawing.dimensions[0].a);
 assert.deepEqual(saved.drawing.dimensions[0].b,drawing.dimensions[0].b);
 await open('oblique.forma.json',saved);
 assert(await field('layout-mode').isChecked());
 assert.deepEqual(await textPoint(),constrained);
 const restoredNote=await noteBounds();
 assert.deepEqual(restoredNote,lowerLeft);
 await field('close').click();
 const titleOverlap=structuredClone(saved);
 titleOverlap.drawing.options.positions.comment=[145,190];
 await open('title-overlap.forma.json',titleOverlap);
 assert.match(await field('status').textContent(),/コメントが表題欄と重なっています/);
 assert(await field('svg').isDisabled());

 const material='SUS304 2B（研磨）',select=field('material-preset'),input=field('material');
 await input.fill(material);
 await field('material-save').click();
 assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),drawingMaterialsKey),[material]);
 assert.equal(await select.inputValue(),material);
 assert(await field('material-save').isDisabled());
 await field('close').click();
 await open('another.forma.json',project);
 assert.equal(await input.inputValue(),'');
 await select.selectOption(material);
 assert.equal(await input.inputValue(),material);
 assert.match(await field('preview').locator('[data-titleblock]').textContent(),/SUS304 2B（研磨）/);
 await field('material-remove').click();
 assert.equal(await select.locator('option').filter({hasText:material}).count(),0);
 assert.equal(await input.inputValue(),material);
 await select.selectOption('SUS304');
 assert.equal(await input.inputValue(),'SUS304');
 await field('comment').fill('印刷配色');
 await field('comment-font').selectOption('rounded');
 await page.waitForFunction(()=>[...document.fonts].some(font=>font.family.includes('Forma comment rounded')&&font.status==='loaded'));
 await field('comment-size').fill('5');await field('comment-size').press('Tab');
 await field('dimension-font').fill('4.2');await field('dimension-font').press('Tab');
 assert.equal(await field('dimension-font').inputValue(),'4.2');
 await field('preview-background').fill('#4488cc');
 await page.waitForFunction(()=>document.querySelector('#drawing-preview [data-paper-background]')?.getAttribute('fill')==='#4488cc');
 const palette=field('print-palette'),paper=preview.locator('[data-paper-background]');
 await palette.selectOption('light');
 assert.equal(await paper.getAttribute('fill'),'#d0e1f2');
 await field('presets').locator('summary').click();
 await field('preset-name').fill('印刷書式');
 await field('preset-save').click();
 await palette.selectOption('mono');
 assert.equal(await paper.getAttribute('fill'),'white');
 await field('comment-font').selectOption('');
 await field('preview-background-reset').click();
 await field('preset-apply').click();
 await page.waitForFunction(()=>document.querySelector('#drawing-preset-status').textContent.includes('呼び出しました'));
 assert.equal(await paper.getAttribute('fill'),'#d0e1f2');
 assert.equal(await palette.inputValue(),'light');
 assert.equal(await field('comment-font').inputValue(),'rounded');
 assert.equal(await field('comment-size').inputValue(),'5');
 assert.equal(await field('dimension-font').inputValue(),'4.2');
 assert.equal(await input.inputValue(),'SUS304');
 const printPDF=(await savePDF()).toString('latin1');
 assert([...printPDF.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)].some(([,r,g,b])=>
  Math.abs(+r-208/255)<.01&&Math.abs(+g-225/255)<.01&&Math.abs(+b-242/255)<.01));
 await field('dimension-auto').click();
 const measured=await preview.locator('[data-dimension] text').allTextContents();
 await field('view-scales').locator('summary').click();
 const topScale=field('view-scales').locator('select[data-view-scale=top]');
 await topScale.selectOption('2');
 assert.deepEqual(await preview.locator('[data-dimension] text').allTextContents(),measured);
 assert.match(await preview.locator('[data-view=top]>text').textContent(),/SCALE 2:1/);
 const geometryWidth=await preview.locator('[data-view=top]>g[transform]').evaluate(el=>{
  const b=el.getBBox(),m=el.ownerSVGElement.getCTM().inverse().multiply(el.getCTM());
  return b.width*Math.hypot(m.a,m.b);
 });
 assert(Math.abs(geometryWidth-100)<.1);
 await field('comment-add').click();
 await field('comment').fill('SECOND NOTE');
 await field('comment-font').selectOption('');
 await field('comment-color').fill('#993300');
 await field('comment-size').fill('3.8');await field('comment-size').press('Tab');
 const addedId=await field('comment-target').inputValue();
 assert(addedId.startsWith('comment-'));
 assert.match(await preview.locator('[data-comment=true]').textContent(),/印刷配色/);
 const addedNote=preview.locator('[data-comment="'+addedId+'"]');
 assert.equal(await addedNote.textContent(),'SECOND NOTE');
 assert.equal(await addedNote.getAttribute('fill'),'#993300');
 await field('comment-target').selectOption('comment');
 assert.equal(await field('comment').inputValue(),'印刷配色');
 assert.equal(await field('comment-font').inputValue(),'rounded');
 await field('comment-target').selectOption(addedId);
 assert.equal(await field('comment').inputValue(),'SECOND NOTE');
 assert.equal(await field('comment-size').inputValue(),'3.8');
 const noteX=await addedNote.evaluate(el=>el.getBBox().x);
 await addedNote.scrollIntoViewIfNeeded();
 const addedBox=await addedNote.boundingBox();
 await page.mouse.move(addedBox.x+addedBox.width/2,addedBox.y+addedBox.height/2);await page.mouse.down();
 await page.mouse.move(addedBox.x+addedBox.width/2+24,addedBox.y+addedBox.height/2+15,{steps:5});await page.mouse.up();
 assert(await addedNote.evaluate(el=>el.getBBox().x)>noteX);
 await field('comment-remove').click();
 assert.equal(await addedNote.count(),0);
 await field('undo').click();
 assert.equal(await addedNote.textContent(),'SECOND NOTE');
 await field('close').click();
 const savedEvent=page.waitForEvent('download');await page.locator('#save').click();
 const noteFile=(await decodeProjectDocument(await fs.readFile(await(await savedEvent).path(),'utf8'))).document;
 assert.equal(noteFile.drawing.options.comments[0].text,'SECOND NOTE');
 assert.equal(noteFile.drawing.options.viewScales.top,2);
 noteFile.drawing.options.sections=[{id:'section-check',view:'front',orientation:'vertical',coordinate:25,reverse:false}];
 noteFile.drawing.options.details=[{id:'detail-check',view:'top',center:[25,-25],radius:5,factor:2}];
 await open('comments-and-scales.forma.json',noteFile);
 assert.equal(await preview.locator('[data-comment="'+addedId+'"]').textContent(),'SECOND NOTE');
 assert.match(await preview.locator('[data-view=top]>text').textContent(),/SCALE 2:1/);
 await field('pdf-layout').selectOption('multi');
 await field('pdf-placement').selectOption('auto');
 await field('pdf-preview-open').click();
 const printPreview=page.locator('#drawing-pdf-preview'),printPage=page.locator('#drawing-pdf-preview-page');
 await printPreview.waitFor();
 const pageCount=await printPage.locator('option').count();
 assert(pageCount>=2);
 await fs.mkdir('.sites-runtime/drawing-page-preview',{recursive:true});
 await page.screenshot({path:'.sites-runtime/drawing-page-preview/overview.png'});
 assert.equal(await printPreview.locator('[data-comment]').count(),2);
 const firstPage=await printPreview.locator('svg').getAttribute('viewBox');
 await page.locator('#drawing-pdf-preview-next').click();
 assert.equal(await printPage.inputValue(),'1');
 assert.equal(await printPreview.locator('[data-comment]').count(),0);
 assert(await printPreview.locator('[data-view^=section-],[data-view^=detail-]').count()>0);
 await page.screenshot({path:'.sites-runtime/drawing-page-preview/auxiliary.png'});
 await page.locator('#drawing-pdf-preview-prev').click();
 assert.equal(await printPreview.locator('svg').getAttribute('viewBox'),firstPage);
 const previewDownload=page.waitForEvent('download');await page.locator('#drawing-pdf-preview-save').click();
 const previewPDF=await fs.readFile(await(await previewDownload).path(),'latin1');
 assert(previewPDF.includes('/Count '+pageCount));
 await page.locator('#drawing-pdf-preview-close').click();
 assert.equal(await preview.locator('[data-comment]').count(),2);
 // Multi-selection never starts a placement drag or changes the comment editor.
 await preview.locator('[data-comment=true] text').first().click({modifiers:['Control']});
 assert(await field('alignment-items').locator('[data-placement-id=comment]').isChecked());
 await preview.locator('[data-comment="'+addedId+'"] text').first().click({modifiers:['Control']});
 assert(await field('alignment-items').locator('[data-placement-id="'+addedId+'"]').isChecked());
 assert.equal(await preview.locator('[data-alignment-selected]').count(),2);
 const alignedX=await preview.locator('[data-comment]').evaluateAll(els=>els.map(el=>el.getBBox().x));
 await page.locator('[data-align-action=left]').click();
 const afterX=await preview.locator('[data-comment]').evaluateAll(els=>els.map(el=>el.getBBox().x));
 assert(Math.abs(afterX[0]-afterX[1])<.01);
 assert(Math.abs(afterX[0]-Math.min(...alignedX))<.01);
 await field('undo').click();
 const undoneX=await preview.locator('[data-comment]').evaluateAll(els=>els.map(el=>el.getBBox().x));
 assert.deepEqual(undoneX,alignedX);
 // Different view and note types appear in the same checklist.
 await field('alignment-items').locator('[data-placement-id=top]').check();
 await field('alignment-items').locator('[data-placement-id=comment]').check();
 assert.equal(await preview.locator('[data-alignment-selected=top]').count(),1);
 await page.locator('[data-align-action=left]').click();
 const mixedX=await preview.locator('[data-alignment-selected]').evaluateAll(els=>els.map(el=>Number(el.getAttribute('x'))));
 assert.equal(mixedX.length,2);
 assert(Math.abs(mixedX[0]-mixedX[1])<.01);
 await field('undo').click();
 await field('alignment-items').locator('[data-placement-id=top]').check();
 await field('alignment-clear').click();
 assert.equal(await preview.locator('[data-alignment-selected]').count(),0);
 await field('pdf-layout').selectOption('manual');
 const pageItem=id=>page.locator('[data-page-item="'+id+'"]');
 await pageItem('top').selectOption('2');
 await pageItem('section-check').selectOption('1');
 await pageItem('detail-check').selectOption('1');
 await pageItem('comment').selectOption('2');
 await pageItem(addedId).selectOption('1');
 await field('pdf-preview-open').click();
 assert.equal(await printPage.locator('option').count(),2);
 assert.equal(await printPreview.locator('[data-view=top]').count(),0);
 assert.equal(await printPreview.locator('[data-view=section-check]').count(),1);
 assert.equal(await printPreview.locator('[data-comment=true]').count(),0);
 assert.equal(await printPreview.locator('[data-comment="'+addedId+'"]').textContent(),'SECOND NOTE');
 await page.locator('#drawing-pdf-preview-next').click();
 assert.equal(await printPreview.locator('[data-view=top]').count(),1);
 assert.equal(await printPreview.locator('[data-view=section-check]').count(),0);
 assert.equal(await printPreview.locator('[data-comment=true]').textContent(),'印刷配色');
 assert.equal(await printPreview.locator('[data-comment="'+addedId+'"]').count(),0);
 await page.screenshot({path:'.sites-runtime/drawing-page-preview/manual.png'});
 const manualDownload=page.waitForEvent('download');await page.locator('#drawing-pdf-preview-save').click();
 assert((await fs.readFile(await(await manualDownload).path(),'latin1')).includes('/Count 2'));
 await page.locator('#drawing-pdf-preview-close').click();
 await field('close').click();
 const assignedDownload=page.waitForEvent('download');await page.locator('#save').click();
 const assignedFile=(await decodeProjectDocument(await fs.readFile(await(await assignedDownload).path(),'utf8'))).document;
 assert.equal(assignedFile.drawing.options.pageAssignments.views.top,2);
 assert.equal(assignedFile.drawing.options.pageAssignments.comments.comment,2);
 assert.equal(assignedFile.drawing.options.pageAssignments.comments[addedId],1);
 await open('assigned-pages.forma.json',assignedFile);
 assert.equal(await field('pdf-layout').inputValue(),'manual');
 await field('page-assignments').locator('summary').click();
 assert.equal(await pageItem('top').inputValue(),'2');
 assert.equal(await pageItem('comment').inputValue(),'2');
 assert.deepEqual(errors,[]);
 console.log('PASS alignment with undo, saved page assignments, comments and scales, PDF preview/export and dimension/material regressions');
}finally{await browser?.close();server.close();}
