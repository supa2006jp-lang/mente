import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[40,20,12]),tool=R.makeBox([8,6,3],[30,14,14]),solid=box.cut(tool);
const features=[{kind:'cadop',id:'part',name:'検証用の角溝',remove:[],outputs:[{
 id:'part',brep:solid.serialize(),...cadMesh(solid),cadCoordinatePrecision:true
}]}];
for(const shape of [box,tool,solid])shape.delete();
const project={format:'forma-cad',version:1,features,drawing:{
 version:1,signature:drawingSignature(features),targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',
 dimensions:[],options:{paper:'A4',orientation:'landscape',frame:false,name:'',material:'',date:'',layout:'projection',
  viewSelection:['front','top','right'],isoMode:'hidden',projectionLocked:true,positions:{}}
}};
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1760,height:1080},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
 const field=id=>page.locator('#drawing-'+id),preview=field('preview');
 const front=preview.locator('[data-view="front"] > g[transform]');
 const manual=preview.locator('[data-dimension-point]');
 const frontManual=preview.locator('[data-dimension-point][data-snap-view="front"]');
 const points=()=>frontManual.evaluateAll(marks=>marks.map(mark=>JSON.parse(mark.dataset.snapPoint)));
 const label=preview.locator('[data-dimension] text');
 async function load(document){
  const buffer=Buffer.from(JSON.stringify(document));
  await page.locator('#file').setInputFiles({name:'drawing-points.forma.json',mimeType:'application/json',buffer});
  await page.locator('#project-preview-open').click();
  await page.locator('#project-load-preview').waitFor({state:'hidden'});
  await field('tool').click();
  await front.waitFor();
 }
 async function screen(at){
  return front.evaluate((g,[x,y])=>{
   const p=new DOMPoint(x,y).matrixTransform(g.getScreenCTM());
   return [p.x,p.y];
  },at);
 }
 async function clickAt(at){await page.mouse.click(...await screen(at));}
 async function download(button){
  const [event]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return readFile(await event.path(),'utf8');
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();
 await load(project);
 await field('dimension-add').click();
 assert.equal(await preview.locator('[data-snap-view="front"][data-snap-point="[8,-3]"]').count(),0);
 await field('dimension-point-add').click();
 assert.equal(await field('dimension-point-add').getAttribute('aria-pressed'),'true');
 await page.mouse.move(...await screen([8.25,-3.25]));
 assert.equal(await preview.locator('[data-action-preview]').count(),1);
 await clickAt([8.25,-3.25]);
 await clickAt([29.75,-3.25]);
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('undo').click();await field('dimension-point-add').click();
 assert.deepEqual(await points(),[[8,-3]]);
 await field('redo').click();await field('dimension-point-add').click();
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('dimension-add').click();
 await frontManual.first().click();await frontManual.last().click();await clickAt([20,7]);
 assert.deepEqual(await label.allTextContents(),['22']);
 await field('scale').selectOption('0.5');
 assert.deepEqual(await label.allTextContents(),['22']);
 await field('scale').selectOption('1');
 await field('dimension-point-add').click();
 const before=await frontManual.first().boundingBox();
 await field('zoom-in').click();
 assert.notDeepEqual(await frontManual.first().boundingBox(),before);
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('zoom-fit').click();
 await page.keyboard.down('Alt');
 await clickAt([20,-2.2]);
 await page.keyboard.up('Alt');
 const free=(await points())[2];
 assert.ok(Math.abs(free[0]-20)<1&&free[1]>-2.9&&free[1]<-1.3);
 const svg=await download(field('svg'));
 assert.match(svg,/data-dimension="0"/);
 assert.doesNotMatch(svg,/data-dimension-point|data-snap-point/);
 await field('pdf-preview-open').click();
 const print=field('pdf-preview-host');
 await print.locator('[data-dimension] text').waitFor();
 assert.equal(await print.locator('[data-dimension] text').textContent(),'22');
 assert.equal(await print.locator('[data-dimension-point],[data-snap-point]').count(),0);
 await field('pdf-preview-close').click();
 await field('close').click();
 const saved=JSON.parse(await download(page.locator('#save')));
 assert.equal(readDrawingState(saved.drawing).dimensionPoints.length,3);
 assert.deepEqual(saved.drawing.dimensions[0].manualEndpoints,['a','b']);
 saved.features[0].name='再読み込みの確認';
 await load(saved);
 assert.deepEqual(await label.allTextContents(),['22']);
 assert.equal(await preview.locator('[data-dimension-review]').count(),0);
 await field('dimension-point-add').click();
 assert.equal(await manual.count(),3);
 await frontManual.first().click();
 await field('delete-selection').click();
 await field('dimension-point-add').click();
 assert.equal(await manual.count(),2);
 assert.deepEqual(await label.allTextContents(),['22']);
 assert.deepEqual(errors,[]);
 console.log('PASS manual dimension points on hidden geometry, free placement, undo and redo, scale and zoom, save and reload, removal, SVG export, and PDF preview');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
