import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {drawingSignature,readDrawingState} from '../src/drawing-state.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[40,20,12]),tool=R.makeBox([8,6,3],[30,14,14]),pocket=box.cut(tool);
const drill=R.makeCylinder(2,14,[35,10,-1]),solid=pocket.cut(drill);
const features=[{kind:'cadop',id:'part',name:'検証用の角溝',remove:[],outputs:[{
 id:'part',brep:solid.serialize(),...cadMesh(solid),cadCoordinatePrecision:true
}]}];
for(const shape of [box,tool,pocket,drill,solid])shape.delete();
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
 const top=preview.locator('[data-view="top"] > g[transform]');
 const manual=preview.locator('[data-dimension-point]');
 const frontManual=preview.locator('[data-dimension-point][data-snap-view="front"]');
 const points=()=>frontManual.evaluateAll(marks=>marks.map(mark=>JSON.parse(mark.dataset.snapPoint)));
 const label=preview.locator('[data-dimension] text');
 const guides=preview.locator('[data-dimension-point-guide]');
 const kind=field('dimension-kind'),hint=field('dimension-hint'),hover=preview.locator('[data-dimension-hover]');
 async function load(document){
  const buffer=Buffer.from(JSON.stringify(document));
  await page.locator('#file').setInputFiles({name:'drawing-points.forma.json',mimeType:'application/json',buffer});
  await page.locator('#project-preview-open').click();
  await page.locator('#project-load-preview').waitFor({state:'hidden'});
  await field('tool').click();
  await front.waitFor();
 }
 async function screen(at,view=front){
  return view.evaluate((g,[x,y])=>{
   const p=new DOMPoint(x,y).matrixTransform(g.getScreenCTM());
   return [p.x,p.y];
  },at);
 }
 async function moveAt(at,view){await page.mouse.move(...await screen(at,view));}
 async function clickAt(at,view){await page.mouse.click(...await screen(at,view));}
 async function labelBoxInFront(){
  return preview.locator('[data-dimension] rect').evaluate(rect=>{
   const front=rect.ownerSVGElement.querySelector('[data-view="front"] > g[transform]');
   const matrix=front.getScreenCTM().inverse().multiply(rect.getScreenCTM());
   const box=rect.getBBox(),top=new DOMPoint(box.x,box.y).matrixTransform(matrix);
   const bottom=new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);
   return {x:(top.x+bottom.x)/2,y:top.y+(bottom.y-top.y)*.75/1.45,top:top.y,bottom:bottom.y};
  });
 }
 async function dragLabelTo(y){
  const start=await labelBoxInFront();
  await page.mouse.move(...await screen([start.x,start.y]));
  await page.mouse.down();
  await page.mouse.move(...await screen([start.x,y]),{steps:5});
  await page.mouse.up();
 }
 async function download(button){
  const [event]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return readFile(await event.path(),'utf8');
 }
 await page.goto(process.env.FORMA_TEST_URL||'http://127.0.0.1:'+server.address().port+'/');
 await page.locator('#canvas-host canvas').waitFor();
 await load(project);
 const selectorBox=await kind.boundingBox(),hintBox=await hint.boundingBox();
 assert.ok(hintBox.y>=selectorBox.y+selectorBox.height,'the hint is below the dimension selector');
 for(const [value,target] of [
  ['horizontal',/横の距離を測る左右の寸法点/],['vertical',/縦の距離を測る上下の寸法点/],
  ['aligned',/両端の寸法点/],['diameter',/直径.*円・円弧の線/],['radius',/半径.*円・円弧の線/],
  ['angle',/２本の直線/],
 ]){
  await kind.selectOption(value);
  assert.match(await hint.textContent(),target);
 }
 await field('dimension-add').click();
 await moveAt([20,-12]);
 assert.equal(await hover.getAttribute('data-dimension-hover'),'line');
 assert.equal(await hover.evaluate(el=>getComputedStyle(el).stroke),'rgb(207, 40, 86)');
 await clickAt([20,-12]);
 assert.match(await hint.textContent(),/２本目の直線/);
 assert.equal(await hover.count(),0);
 await moveAt([24,-12]);
 assert.equal(await hover.count(),0);
 await moveAt([0,-6]);
 assert.equal(await hover.getAttribute('data-dimension-hover'),'line');
 await clickAt([0,-6]);
 assert.match(await hint.textContent(),/置く位置/);
 assert.equal(await hover.count(),0);
 await kind.selectOption('radius');
 await field('dimension-add').click();
 const arcPoint=await top.locator('g:not([data-hidden]) > [data-curve][d*=" A "]').first().evaluate(path=>{
  const point=path.getPointAtLength(path.getTotalLength()/3);
  return [point.x,point.y];
 });
 await moveAt(arcPoint,top);
 assert.equal(await hover.getAttribute('data-dimension-hover'),'arc');
 assert.equal(await field('snap-label').textContent(),'円周');
 await kind.hover();
 assert.equal(await hover.count(),0);
 const arcScreen=await screen(arcPoint,top);
 await page.mouse.move(...arcScreen);
 assert.equal(await hover.getAttribute('data-dimension-hover'),'arc');
 await page.mouse.click(...arcScreen);
 assert.match(await field('status').textContent(),/寸法 2 mm/);
 assert.equal(await hover.count(),0);
 await kind.selectOption('horizontal');
 assert.match(await hint.textContent(),/「寸法線を追加」.*横の距離/);
 assert.equal(await field('dimension-cancel').isHidden(),true);
 await field('dimension-add').click();
 await moveAt([.2,-11.9]);
 assert.equal(await hover.getAttribute('data-snap-point'),'[0,-12]');
 assert.equal(await hover.evaluate(el=>getComputedStyle(el).fill),'rgb(207, 40, 86)');
 await moveAt([20,-6]);
 assert.equal(await hover.count(),0);
 assert.equal(await preview.locator('[data-snap-view="front"][data-snap-point="[8,-3]"]').count(),0);
 await field('dimension-point-add').click();
 assert.equal(await field('dimension-point-add').getAttribute('aria-pressed'),'true');
 await page.mouse.move(...await screen([8.25,-3.25]));
 assert.equal(await preview.locator('[data-action-preview]').count(),1);
 await clickAt([8.25,-3.25]);
 assert.equal(await guides.count(),2);
 assert.equal(await preview.locator('[data-dimension-point-guide="horizontal"]').getAttribute('y1'),
  await frontManual.first().getAttribute('cy'));
 assert.equal(await preview.locator('[data-dimension-point-guide="vertical"]').getAttribute('x1'),
  await frontManual.first().getAttribute('cx'));
 await clickAt([29.75,-3.25]);
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('undo').click();await field('dimension-point-add').click();
 assert.deepEqual(await points(),[[8,-3]]);
 await field('redo').click();await field('dimension-point-add').click();
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('dimension-add').click();
 assert.equal(await guides.count(),0);
 await moveAt([8.25,-3.25]);
 assert.equal(await hover.getAttribute('data-snap-point'),'[8,-3]');
 assert.ok(await hover.getAttribute('data-dimension-point'));
 await frontManual.first().click();
 assert.match(await hint.textContent(),/２点目の寸法点/);
 assert.equal(await hover.count(),0);
 await moveAt([30.25,-3.25]);
 assert.equal(await hover.getAttribute('data-snap-point'),'[30,-3]');
 await frontManual.last().click();
 assert.match(await hint.textContent(),/置く位置/);
 assert.equal(await hover.count(),0);
 await clickAt([20,.5]);
 assert.match(await hint.textContent(),/「寸法線を追加」.*横の距離/);
 assert.deepEqual(await label.allTextContents(),['22']);
 const nearOutline=await labelBoxInFront();
 assert.ok(nearOutline.top>.15&&nearOutline.top<.85,JSON.stringify(nearOutline));
 await dragLabelTo(-3);
 const nearHiddenLine=await labelBoxInFront();
 assert.ok(nearHiddenLine.bottom<-3.1&&nearHiddenLine.bottom>-3.95,JSON.stringify(nearHiddenLine));
 await field('undo').click();
 assert.deepEqual(await labelBoxInFront(),nearOutline);
 await field('redo').click();
 assert.deepEqual(await labelBoxInFront(),nearHiddenLine);
 await field('hidden').uncheck();
 await dragLabelTo(-3);
 const overHiddenLine=await labelBoxInFront();
 assert.ok(Math.abs(overHiddenLine.y+3)<.35,JSON.stringify(overHiddenLine));
 await field('hidden').check();
 await dragLabelTo(7);
 assert.ok(Math.abs((await labelBoxInFront()).y-7)<.35);
 assert.deepEqual(await label.allTextContents(),['22']);
 await field('scale').selectOption('0.5');
 assert.deepEqual(await label.allTextContents(),['22']);
 await field('scale').selectOption('1');
 await label.click();
 const valueInput=field('dimension-value');
 assert.equal(await valueInput.inputValue(),'22');
 await valueInput.fill('21.75');
 await valueInput.press('Enter');
 assert.equal(await label.textContent(),'21.75');
 assert.match(await field('dimension-measured-value').textContent(),/22 mm/);
 await field('undo').click();assert.equal(await label.textContent(),'22');
 await field('redo').click();assert.equal(await label.textContent(),'21.75');
 await label.click();await field('dimension-value-reset').click();
 assert.equal(await label.textContent(),'22');
 await valueInput.fill('20');
 await valueInput.press('Enter');
 assert.equal(await label.textContent(),'20');
 await valueInput.fill('0');
 await valueInput.press('Enter');
 assert.equal(await label.textContent(),'20');
 await field('dimension-point-add').click();
 const before=await frontManual.first().boundingBox();
 await field('zoom-in').click();
 assert.notDeepEqual(await frontManual.first().boundingBox(),before);
 assert.deepEqual(await points(),[[8,-3],[30,-3]]);
 await field('zoom-fit').click();
 await page.keyboard.down('Alt');
 await clickAt([16,-7.3]);
 await page.keyboard.up('Alt');
 const free=(await points())[2];
 assert.ok(Math.abs(free[0]-16)<1&&Math.abs(free[1]+7.3)<1);
 assert.equal(await guides.count(),2);
 await clickAt([30.25,free[1]+.35]);
 assert.deepEqual((await points())[3],[30,free[1]]);
 const svg=await download(field('svg'));
 assert.match(svg,/data-dimension="0"/);
 assert.match(svg,/>20<\/text>/);
 assert.doesNotMatch(svg,/data-dimension-hover|data-dimension-point|data-snap-point/);
 await field('pdf-preview-open').click();
 const print=field('pdf-preview-host');
 await print.locator('[data-dimension] text').waitFor();
 assert.equal(await print.locator('[data-dimension] text').textContent(),'20');
 assert.equal(await print.locator('[data-dimension-hover],[data-dimension-point],[data-snap-point],[data-dimension-point-guide]').count(),0);
 await field('pdf-preview-close').click();
 await field('close').click();
 const saved=JSON.parse(await download(page.locator('#save')));
 assert.equal(readDrawingState(saved.drawing).dimensionPoints.length,4);
 assert.deepEqual(saved.drawing.dimensions[0].manualEndpoints,['a','b']);
 assert.equal(saved.drawing.dimensions[0].displayValue,20);
 assert.deepEqual([saved.drawing.dimensions[0].a,saved.drawing.dimensions[0].b],[[8,-3],[30,-3]]);
 saved.features[0].name='再読み込みの確認';
 await load(saved);
 assert.deepEqual(await label.allTextContents(),['20']);
 assert.equal(await preview.locator('[data-dimension-review]').count(),0);
 await field('dimension-point-add').click();
 assert.equal(await manual.count(),4);
 await frontManual.first().click();
 await field('delete-selection').click();
 await field('dimension-point-add').click();
 assert.equal(await manual.count(),3);
 assert.deepEqual(await label.allTextContents(),['20']);
 await field('close').click();

 const short={view:'front',kind:'horizontal',a:[0,0],b:[3,0],at:[1.5,8],precision:1,fontSize:3.4,
  displayValue:3.25,lineColor:'#123456',textColor:'#654321',note:'端',tolerance:.2,pinned:true,manualEndpoints:['b']};
 const previousBatch=[15,37].map((x,i)=>({
  view:'front',kind:'horizontal',a:[0,0],b:[x,0],at:[18,21+7*i],
  manualEndpoints:['b'],pdfPlacement:{at:[18,22+7*i]},
 }));
 const linearProject={...project,drawing:{...project.drawing,dimensions:[short,...previousBatch],dimensionPoints:[3,15,37].map(x=>({
  id:'dimension-point-linear-'+x,view:'front',point:[x,0],
 })),options:{...project.drawing.options,projectionLocked:false,positions:{front:[80,90]},
  pdfLayout:'manual',pageAssignments:{pageCount:2,views:{front:2},comments:{}},
 }}};
 await load(linearProject);
 assert.equal(await field('dimension-method').count(),0);
 assert.equal(await field('dimension-points-done').count(),0);
 const outside=preview.locator('[data-dimension-outside]');
 assert.equal(await outside.count(),1);
 await field('pdf-preview-open').click();
 await field('pdf-preview').locator('[data-pdf-page="2"] .drawing-pdf-page-thumb').click();
 assert.equal(await print.locator('[data-dimension-outside]').count(),1);
 await field('pdf-preview-close').click();
 await label.first().click();
 await field('dimension-replace-b').click();
 const picked=preview.locator('[data-dimension-picked]');
 assert.equal(await picked.count(),1);
 assert.match(await hint.textContent(),/付け替え先/);
 await clickAt([0,0]);
 assert.match(await field('status').textContent(),/寸法が０/);
 await moveAt([37,0]);
 assert.equal(await hover.getAttribute('data-dimension-point'),'dimension-point-linear-37');
 await clickAt([37,0]);
 assert.equal(await outside.count(),0);
 const labels=['37.0 ±0.2 端','15','37'];
 assert.deepEqual(await label.allTextContents(),labels);
 assert.equal(await label.first().getAttribute('fill'),short.textColor);
 assert.equal(await field('dimension-pin').isChecked(),true);
 assert.equal(await picked.count(),0);

 await field('page-edit').selectOption('1');
 assert.deepEqual(await label.allTextContents(),labels);
 await field('pdf-preview-open').click();
 await field('pdf-preview').locator('[data-pdf-page="2"] .drawing-pdf-page-thumb').click();
 assert.deepEqual(await print.locator('[data-dimension] text').allTextContents(),labels);
 assert.equal(await print.locator('[data-dimension-picked]').count(),0);
 await field('pdf-preview-close').click();
 await field('close').click();
 const result=readDrawingState(JSON.parse(await download(page.locator('#save'))).drawing);
 const {displayValue,...appearance}=short;
 assert.deepEqual(result.dimensions[0],{...appearance,b:[37,0]});
 assert.deepEqual(result.dimensions.slice(1),previousBatch);

 const filletBox=R.makeBox([0,0,0],[52.066,31,21.965]);
 const rounded=filletBox.fillet(5,finder=>finder.inDirection('Z'));
 const roundedFeatures=[{kind:'cadop',id:'part',name:'R5の試験片',remove:[],outputs:[{
  id:'part',brep:rounded.serialize(),...cadMesh(rounded),cadCoordinatePrecision:true,
 }]}];
 filletBox.delete();rounded.delete();
 await load({...project,features:roundedFeatures,drawing:{...project.drawing,
  signature:drawingSignature(roundedFeatures),scale:1.9,options:{...project.drawing.options,projectionLocked:false,
   positions:{front:[75,113],top:[75,34],right:[200,113]},
  },
 }});
 await kind.selectOption('horizontal');
 await field('dimension-add').click();
 const autoPoint=(view,point)=>preview.locator('[data-snap-view="'+view+'"][data-snap-point="'+JSON.stringify(point)+'"]');
 assert.equal(await preview.locator('[data-snap-view="front"]').count(),8);
 assert.equal(await preview.locator('[data-snap-view="right"]').count(),8);
 assert.equal(await autoPoint('top',[5,-5]).count(),1,'the radius center remains selectable');
 assert.equal(await autoPoint('top',[0,-5]).count(),1,'the arc endpoint remains selectable');
 await autoPoint('front',[5,0]).hover();
 assert.equal(await hover.getAttribute('data-snap-point'),'[5,0]');
 await autoPoint('front',[5,0]).click();
 await autoPoint('front',[47.066,0]).click();
 await clickAt([26,9]);
 assert.equal(await label.textContent(),'42.066');
 await field('dimension-point-add').click();
 await clickAt([2.65,-.1]);
 const [custom]=await points();
 assert.ok(custom[0]>0&&custom[0]<5&&custom[1]===0);

 // Point placement and dimension picking share centers on the actual B-rep.
 await field('close').click();
 const block=R.makeBox([-28,-16,0],[28,16,12]);
 const slotTool=R.draw([-6,-10]).lineTo([2,-10]).threePointsArcTo([2,-6],[4,-8])
  .lineTo([-6,-6]).threePointsArcTo([-6,-10],[-8,-8]).close().sketchOnPlane('XY',-1).extrude(14);
 const slotted=block.cut(slotTool);
 const stock={kind:'cadop',id:'stock',name:'長穴付きのプレート',remove:[],outputs:[{
  id:'stock',brep:slotted.serialize(),...cadMesh(slotted),cadCoordinatePrecision:true
 }]};
 for(const shape of [block,slotTool,slotted])shape.delete();
 const hole=(id,x)=>({...defaults,kind:'extrusion',id,name:'穴',profile:'circle',diameter:6,x,y:4,z:12,
  depth:-9,hole:true,operation:'cut',target:stock.id});
 const drilled=[stock,hole('round-hole',-12),hole('thread-hole',9)];
 const thread={type:'thread',target:stock.id,id:'thread',surfacePoint:[12,4,10],pitch:1,profile:'metric60',
  threadVersion:2,fullLength:true,leftHand:true};
 const withThread=(features,spec=thread)=>[...features,{kind:'cadop',id:spec.id,name:'ねじ穴',spec,...runOperation(features,spec)}];
 const threaded=withThread(drilled);
 await load({...project,features:threaded,drawing:{...project.drawing,signature:drawingSignature(threaded),targets:[stock.id]}});
 const centers=preview.locator('[data-dimension-center-guide]');
 assert.equal(await centers.count(),0);
 const snapLabel=field('snap-label');
 await kind.selectOption('horizontal');
 await field('dimension-add').click();
 assert.equal(await preview.locator('[data-dimension-center-guide="top"]').count(),3);
 const ordinary=[-11.7,-4.23],slot=[-1.8,8.14],screw=[9.22,-3.82];
 await moveAt(ordinary,top);
 assert.equal(await snapLabel.isVisible(),true);
 assert.equal(await snapLabel.textContent(),'穴中心 Ø6');
 assert.equal(await hover.getAttribute('data-dimension-hover'),'center');
 await clickAt(ordinary,top);
 await moveAt(slot,top);
 assert.equal(await snapLabel.textContent(),'長穴中心');
 await clickAt(slot,top);
 await clickAt([-5,20],top);
 assert.deepEqual(await label.allTextContents(),['10']);
 assert.equal(await snapLabel.isHidden(),true);

 await field('dimension-point-add').click();
 assert.equal(await preview.locator('[data-dimension-center-guide="top"]').count(),3);
 const symbol=centers.first().locator('path').last();
 const width=(await symbol.boundingBox()).width;
 await field('zoom-in').click();
 assert.ok(Math.abs((await symbol.boundingBox()).width-width)<.05);
 await field('zoom-fit').click();
 for(const [position,text] of [[ordinary,'穴中心 Ø6'],[screw,'ねじ穴中心 M6']]){
  const [x,y]=await screen(position,top);
  await page.mouse.move(x,y);
  assert.equal(await preview.locator('[data-action-preview]').count(),1);
  assert.equal(await snapLabel.textContent(),text);
  await page.mouse.click(x,y);
 }
 assert.deepEqual(await manual.evaluateAll(marks=>marks.map(mark=>JSON.parse(mark.dataset.snapPoint))),[[-12,-4],[9,-4]]);
 assert.equal(await guides.count(),2);
 await field('pdf-preview-open').click();
 assert.equal(await field('pdf-preview-host').locator('[data-dimension-center-guide]').count(),0);
 await field('pdf-preview-close').click();
 await field('dimension-cancel').click();
 assert.equal(await centers.count(),0);

 await field('dimension-add').click();
 await clickAt(ordinary,top);
 await moveAt(screw,top);
 assert.equal(await snapLabel.textContent(),'ねじ穴中心 M6');
 await clickAt(screw,top);
 await clickAt([0,-22],top);
 assert.deepEqual(await label.allTextContents(),['10','21']);
 await field('close').click();
 const linked=JSON.parse(await download(page.locator('#save'))),drawing=readDrawingState(linked.drawing);
 assert.equal(drawing.dimensionPoints[0].holeRef.sourceId,'round-hole');
 assert.equal(drawing.dimensionPoints[1].holeRef.threadRef.id,'thread');
 assert.deepEqual(drawing.dimensions[0].holeRefs,{a:{sourceId:'round-hole'}});
 assert.deepEqual(drawing.dimensions[1].manualEndpoints,['a','b']);
 assert.equal(drawing.dimensions[1].holeRefs.b.threadRef.id,'thread');
 const moved=withThread([stock,hole('round-hole',-7),hole('thread-hole',13)],{...thread,surfacePoint:[16,4,10]});
 await load({...linked,features:moved});
 assert.deepEqual(await label.allTextContents(),['5','20']);
 assert.equal(await field('review-list').isHidden(),true);
 await field('dimension-point-add').click();
 assert.deepEqual(await manual.evaluateAll(marks=>marks.map(mark=>JSON.parse(mark.dataset.snapPoint))),[[-7,-4],[13,-4]]);

 assert.deepEqual(errors,[]);
 console.log('PASS manual points, round/slot/thread centers and snap labels, linked dimensions after moving a modeled hole, guides, clearance, value override, endpoint replacement, undo, SVG export, PDF preview and fillet dimension targets');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
