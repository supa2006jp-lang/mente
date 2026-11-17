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
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
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
  return [[box.x+box.width/2,box.y+box.height/2],[30,198]].map(point=>{
   const p=new DOMPoint(...point).matrixTransform(matrix);return [p.x,p.y];
  });
 });
 await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps:6});await page.mouse.up();
 const noteBounds=()=>note.evaluate(node=>{
  const {x,y,width,height}=node.getBBox();return {x,y,width,height};
 });
 const lowerLeft=await noteBounds();
 assert(lowerLeft.y>178&&lowerLeft.y+lowerLeft.height<205&&lowerLeft.x+lowerLeft.width<132);
 assert(!(await field('svg').isDisabled()));
 assert(!(await field('pdf').isDisabled()));
 const svgDownload=page.waitForEvent('download');await field('svg').click();
 assert.match(await fs.readFile(await(await svgDownload).path(),'utf8'),/>LOWER LEFT NOTE<\/text>/);
 const pdfDownload=page.waitForEvent('download');await field('pdf').click();
 assert.equal((await fs.readFile(await(await pdfDownload).path())).subarray(0,5).toString(),'%PDF-');
 await field('close').click();
 const download=page.waitForEvent('download');
 await page.locator('#save').click();
 const file=await fs.readFile(await(await download).path(),'utf8');
 const saved=(await decodeProjectDocument(file)).document;
 assert(saved.drawing.dimensions[0].alongOffset>0);
 assert.deepEqual(saved.drawing.dimensions[0].a,drawing.dimensions[0].a);
 assert.deepEqual(saved.drawing.dimensions[0].b,drawing.dimensions[0].b);
 await open('oblique.forma.json',saved);
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
 assert.deepEqual(errors,[]);
 console.log('PASS collision repair, oblique dimension drag and save/reload, and material library across drawings');
}finally{await browser?.close();server.close();}
