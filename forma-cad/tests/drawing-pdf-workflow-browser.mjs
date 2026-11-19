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
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();

 async function open(state){
  const project={format:'forma-cad',version:1,features,drawing:state};
  await page.locator('#file').setInputFiles({name:'drawing-pdf-check.forma.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.locator('#project-preview-open').click();
  await field('tool').click();
  await editor.locator('[data-view=front]').waitFor();
 }

 await open(drawing);
 assert.equal(await field('pdf-placement').inputValue(),'keep');
 await field('pdf').click();
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
 const overflow={...drawing,dimensions:[],options:{...drawing.options,positions:{...drawing.options.positions,top:[45,12]}}};
 await open(overflow);
 await field('pdf-preview-open').click();
 assert(await preview.locator('[data-pdf-issue=layout]').count());
 assert(await field('pdf-preview-save').isDisabled());
 await field('pdf-preview-close').click();
 await field('pdf-placement').selectOption('auto');
 await field('pdf-preview-open').click();
 assert.equal(await preview.locator('[data-pdf-issue=layout]').count(),0);
 assert.equal(await print.locator('svg').getAttribute('data-layout'),'compact');
 await field('pdf-preview-close').click();
 await field('close').click();

 await open({...drawing,dimensions:[]});
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
 assert.deepEqual(errors,[]);
 console.log('PASS PDF placement, warning navigation, overflow, scale captions, export and manufacturing dimensions');
}finally{await browser?.close();server.close();}
