import assert from 'node:assert/strict';
import {test} from 'node:test';
import {autoDrawingDimensions,hideDuplicateOverallDimensions} from '../src/drawing-auto-dimensions.js';
import {drawingPDFHasMultiplePages,drawingPDFPages,remapDrawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingPDFIssues} from '../src/drawing-sheet-check.js';
import {dimensionValue,drawingDimensionGeometry} from '../src/drawing-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {optimizeDrawingLayout} from '../src/drawing-auto-layout.js';
import {readDrawingState} from '../src/drawing-state.js';
import {drawingScaleLabel,minDrawingScale,maxDrawingScale,parseDrawingScale,projectDrawingIsometric,snapDrawingResizeScale,stepDrawingScale} from '../src/drawing-view-preferences.js';

const rect=(w,h)=>({visible:[`M 0 0 L ${w} 0 L ${w} ${-h} L 0 ${-h} Z`],hidden:[]});
const part={bounds:[[0,0,0],[60,40,20]],bodyCount:1,views:{
 front:rect(60,20),top:rect(60,40),right:rect(40,20),
 'section-a':{...rect(40,20),viewBox:[0,-20,40,20]},
}};
const options={paper:'A4',orientation:'landscape',frame:true,layout:'projection',projectionLocked:true,isoMode:'hidden',
 name:'プレート',material:'',date:'',positions:{top:[50,30],front:[50,100],right:[165,100],'section-a':[195,65],comment:[155,55]},
 sections:[{id:'section-a',view:'front',orientation:'vertical',coordinate:20,reverse:false}],
};
const frontDimension={view:'front',kind:'horizontal',a:[0,0],b:[60,0],at:[25,12]};
const header=sheet=>sheet.svg.match(/data-sheet-scale="true">([^<]+)/)?.[1];

test('the editor announces a PDF only when more than one page will be produced',()=>{
 const views=['front','top','right'];
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:''}),false);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'manual',pageAssignments:{pageCount:1}}),false);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'manual',pageAssignments:{pageCount:2}}),true);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'multi'}),false);
 assert.equal(drawingPDFHasMultiplePages([...views,'section-a'],{pdfLayout:'multi'}),true);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'multi',holeTable:{view:'top'}}),true);
});

test('an assigned PDF preserves editor positions, real scales, wrapped notes and sheet size',()=>{
 const dimension={...frontDimension,at:[20,10]},notes='Plate note\nKeep this note with the section.';
 const config={...options,paper:'auto',pdfLayout:'manual',pageAssignments:{pageCount:3,views:{},comments:{comment:2}}};
 const editor=drawingSheet(part,1,true,[dimension],notes,config);
 const pages=drawingPDFPages(part,1,true,[dimension],notes,config,editor);
 assert.equal(pages.length,3);
 assert.deepEqual(pages.map(({width,height})=>[width,height]),Array.from({length:3},()=>[editor.width,editor.height]));
 assert.deepEqual(Object.keys(pages[0].layout).sort(),['front','right','top']);
 assert.deepEqual(pages[0].layout.top,editor.layout.top);
 assert.deepEqual(pages[0].layout.right,editor.layout.right);
 assert.deepEqual(pages[0].dimensions,[dimension]);
 assert.match(pages[0].svg,/THIRD ANGLE/);
 assert.deepEqual(pages[1].layout['section-a'],editor.layout['section-a']);
 assert.doesNotMatch(pages[1].svg,/THIRD ANGLE/);
 assert.deepEqual(pages[1].note,editor.note);
 assert.deepEqual(pages[2].layout,{});
 assert.equal(header(pages[2]),'mm');
});

test('splitting off auxiliary views preserves the overview and auto placement still repacks',()=>{
 const editor=drawingSheet(part,1,true,[],'',options);
 const [first,second]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'multi'},editor);
 assert.deepEqual(first.layout.front,editor.layout.front);
 assert.deepEqual(second.layout['section-a'],editor.layout['section-a']);
 const [auto]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',pdfPlacement:'auto'},editor);
 assert.match(auto.svg,/data-layout="compact"/);
 assert.notDeepEqual(auto.layout.front,editor.layout.front);
 const [side]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',
  viewScales:{right:.5},pageAssignments:{pageCount:2,views:{right:1,front:2,top:2},comments:{}}});
 assert.equal(side.layout.right.scale,.5);
 assert.equal(side.layout.right.y,105);
});

test('paper and view captions use the actual scale on each page',()=>{
 const config={...options,viewScales:{top:2},pdfLayout:'manual',pageAssignments:{pageCount:2,views:{top:2,'section-a':1},comments:{}}};
 const sheet=drawingSheet(part,.5,true,[],'',config);
 assert.equal(header(sheet),'縮尺は各図に記載 / mm');
 assert.match(sheet.svg,/TOP \/ SCALE 2:1/);
 assert.match(sheet.svg,/FRONT \/ SCALE 1:2/);
 assert.ok(sheet.viewTitles.front.y+sheet.viewTitles.front.height<sheet.layout.front.y-8);
 const [other,top]=drawingPDFPages(part,.5,true,[],'',config,sheet);
 assert.equal(header(other),'SCALE 1:2 / mm');
 assert.equal(header(top),'SCALE 2:1 / mm');
 assert.equal(top.layout.top.width,120);
 assert.doesNotMatch(top.svg,/TOP \/ SCALE/);
});

test('the PDF checklist maps a filtered page back to original visible dimension indices',()=>{
 const top={...frontDimension,view:'top'};
 const hidden={...frontDimension,review:true,hidden:true};
 const review={...frontDimension,review:true,at:[30,44]};
 const overlap={...frontDimension,a:[10,0],b:[50,0]};
 const config={...options,pdfLayout:'manual',pageAssignments:{pageCount:2,views:{front:2},comments:{}}};
 const pages=drawingPDFPages(part,1,true,[top,frontDimension,hidden,overlap,review],'',config);
 const issues=drawingPDFIssues(pages);
 assert.deepEqual(issues.filter(issue=>issue.kind==='overlap').map(issue=>[issue.pageIndex,issue.dimension]),[[1,1],[1,3]]);
 assert.deepEqual(issues.filter(issue=>issue.kind==='reference').map(issue=>[issue.pageIndex,issue.dimension]),[[1,4]]);
});

test('manufacturing dimensions choose a visible enabled view for each axis',()=>{
 const sheet=drawingSheet(part,1,true,[],'',options);
 const all=autoDrawingDimensions(part,1,[],sheet).dimensions;
 assert.equal(all.filter(d=>d.overall).length,6);
 const unique=autoDrawingDimensions(part,1,[],sheet,{uniqueAxes:true,views:{front:['vertical']}}).dimensions;
 assert.deepEqual(unique.filter(d=>d.overall).map(d=>d.overall),['frontvertical','tophorizontal','topvertical']);
 const pinned={...all.find(d=>d.overall==='tophorizontal'),pinned:true};
 const current=all.map(d=>d.overall===pinned.overall?pinned:d);
 const compact=hideDuplicateOverallDimensions(current,sheet);
 assert.equal(compact.hidden,3);
 assert.ok(compact.dimensions.find(d=>d.overall==='fronthorizontal').hidden);
 assert.strictEqual(compact.dimensions.find(d=>d.overall===pinned.overall),pinned);
 assert.equal(autoDrawingDimensions(part,1,compact.dimensions,sheet,{uniqueAxes:true}).dimensions.length,0);
 assert.equal(current.some(d=>d.hidden),false);
});

test('automatic isometric dimensions use full spans between visible model vertices',()=>{
 const vertices=[[0,0,0],[60,0,0],[60,40,0],[60,40,20],[0,40,20],[0,0,20],[60,0,20]]
  .map(model=>({model,point:projectDrawingIsometric(model)}));
 const visible=['M '+vertices.slice(0,6).map(({point})=>point.join(' ')).join(' L ')+' Z'];
 const iso={visible,hidden:[],viewBox:[0,-80/Math.sqrt(6),100/Math.SQRT2,140/Math.sqrt(6)],dimensionVertices:vertices};
 const data={...part,views:{iso}};
 const isoSheet=drawingSheet(data,.5,true,[],'',{...options,viewSelection:[],isoMode:'full',positions:{iso:[85,75]},sections:[]});
 const dims=autoDrawingDimensions(data,.5,[],isoSheet).dimensions;
 assert.deepEqual(dims.map(dimensionValue),[60,40,20]);
 assert.ok(dims.every(d=>d.view==='iso'&&d.kind==='aligned'&&d.automatic));
 for(const d of dims){
  const [[a,b]]=drawingDimensionGeometry(d,isoSheet.layout.iso).extensions;
  assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<12,'extension line stays close to the projected outline');
 }
 const [first]=dims;
 const manual={view:'iso',kind:'aligned',a:first.b,b:first.a,modelA:first.modelB,modelB:first.modelA,at:first.at};
 assert.deepEqual(autoDrawingDimensions(data,.5,[manual],isoSheet).dimensions.map(dimensionValue),[40,20]);
 assert.equal(autoDrawingDimensions(data,.5,dims,isoSheet).dimensions.length,0);
 assert.equal(autoDrawingDimensions(data,.5,[],isoSheet,{views:{iso:[]}}).dimensions.length,0);
 assert.equal(autoDrawingDimensions(data,.5,[],isoSheet,{types:['diameter']}).dimensions.length,0);
 const incomplete={...data,views:{iso:{...iso,dimensionVertices:[vertices[0],vertices[3]]}}};
 assert.equal(autoDrawingDimensions(incomplete,.5,[],isoSheet).dimensions.length,0,'no full span uses unrelated diagonal vertices');
 const combined={...data,views:{...part.views,iso}};
 const multi=drawingSheet(combined,.5,true,[],'',{...options,isoMode:'full'});
 const all=autoDrawingDimensions(combined,.5,[],multi).dimensions;
 assert.equal(all.filter(d=>d.view==='iso').length,3);
 assert.equal(autoDrawingDimensions(combined,.5,[],multi,{uniqueAxes:true}).dimensions.filter(d=>d.view==='iso').length,0);
 assert.ok(hideDuplicateOverallDimensions(all,multi).dimensions.filter(d=>d.view==='iso').every(d=>d.hidden));
 const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:.5,hidden:true,comment:'',dimensions:dims,
  options:{...options,isoMode:'full',autoDimensionViews:{iso:[]}}};
 assert.deepEqual(readDrawingState(saved),saved);
});

test('PDF placement and compact exterior dimensions round-trip in drawing state',()=>{
 const state={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],
  options:{...options,pdfPlacement:'auto',uniqueOverallDimensions:true}};
 assert.deepEqual(readDrawingState(state),state);
 assert.throws(()=>readDrawingState({...state,options:{...state.options,pdfPlacement:'other'}}));
 assert.throws(()=>readDrawingState({...state,options:{...state.options,uniqueOverallDimensions:'true'}}));
});

test('custom scale input accepts ratios and decimals within the saved drawing range',()=>{
 for(const input of ['1:2.5','１：２．５','0.4','.4','2 / 5'])assert.equal(parseDrawingScale(input),.4);
 assert.equal(parseDrawingScale('3:2'),1.5);
 for(const input of ['0','-5','1:0','1:4:3','1e1','1001','1:11000','NaN',''])assert.equal(parseDrawingScale(input),null);
});

test('the keyboard and resize handle adjust the drawing scale in tenths',()=>{
 assert.equal(stepDrawingScale(.3,1),.4);
 assert.equal(stepDrawingScale(.3,-1),.2);
 assert.equal(stepDrawingScale(.375,1),.4);
 assert.equal(stepDrawingScale(.375,-1),.3);
 assert.equal(stepDrawingScale(maxDrawingScale,1),maxDrawingScale);
 assert.equal(drawingScaleLabel(stepDrawingScale(.1,-1)),'1:10.1');
 assert.equal(stepDrawingScale(1/10.1,1),.1);
 assert.equal(drawingScaleLabel(stepDrawingScale(.05,-1)),'1:20.1');
 assert.equal(stepDrawingScale(minDrawingScale,-1),minDrawingScale);
 const resize=(start,target)=>snapDrawingResizeScale(start,target,minDrawingScale,maxDrawingScale);
 assert.equal(resize(1,1.04),1);
 assert.equal(resize(1,1.06),1.1);
 assert.equal(resize(1,.94),.9);
 assert.equal(resize(.43,.43),.43);
 assert.equal(resize(.43,.44),.43);
 assert.equal(resize(.43,.46),.5);
 assert.equal(resize(.1,.04),.1);
 assert.equal(drawingScaleLabel(resize(.05,.045)),'1:22.2');
 assert.equal(snapDrawingResizeScale(.4,.67,.1,.65),.6);
});

test('scale captions retain exact tenths even when the reciprocal has long decimals',()=>{
 for(const [scale,label] of [[.3,'0.3:1'],[.6,'0.6:1'],[.7,'0.7:1'],[.8,'0.8:1'],[.9,'0.9:1'],[.4,'1:2.5'],[.5,'1:2'],[.05,'1:20'],[1.2,'1.2:1']]){
  assert.equal(drawingScaleLabel(scale),label);
  assert.equal(parseDrawingScale(label),scale);
 }
 assert.equal(drawingScaleLabel(.899999),'0.9:1');
 const config={...options,viewScales:{front:.9},pdfLayout:'manual',pageAssignments:{pageCount:2,views:{},comments:{}}};
 const editor=drawingSheet(part,1,true,[frontDimension],'',config);
 const [first]=drawingPDFPages(part,1,true,[frontDimension],'',config,editor);
 for(const sheet of [editor,first]){
  assert.match(sheet.svg,/FRONT \/ SCALE 0\.9:1/);
  assert.equal(sheet.layout.front.width,54);
  assert.doesNotMatch(sheet.svg,/1:1\.1111/);
 }
});

test('automatic drawing and PDF layouts choose the largest fitting tenth or small ratio',()=>{
 const input={dimensions:[frontDimension],options};
 const layout=optimizeDrawingLayout(part,input);
 assert(layout.scale>=.1);
 assert.equal(layout.scale*10,Math.round(layout.scale*10));
 const next=(Math.round(layout.scale*10)+1)/10;
 assert.equal(optimizeDrawingLayout(part,{...input,scale:next,fixedScale:true}),null);
 for(const {x,y,width,height} of layout.boxes){
  assert(x>=layout.area.x-1e-8&&y>=layout.area.y-1e-8);
  assert(x+width<=layout.area.x+layout.area.width+1e-8&&y+height<=layout.area.y+layout.area.height+1e-8);
 }
 const [first]=drawingPDFPages(part,1,true,[frontDimension],'',{...options,pdfLayout:'multi',pdfPlacement:'auto'});
 assert.equal(first.pageScale*10,Math.round(first.pageScale*10));
 const wide={bodyCount:1,bounds:[[0,0,0],[12000,60,30]],views:{front:rect(12000,30)}};
 const smallOptions={...options,viewSelection:['front'],sections:[]};
 const small=optimizeDrawingLayout(wide,{options:smallOptions});
 assert(small.scale<.1);
 assert.match(drawingScaleLabel(small.scale),/^1:\d+(?:\.\d)?$/);
});

test('initial layout reserves the right side for ISO and can pack linked projections',()=>{
 const iso={...rect(70,57),viewBox:[0,-57,70,57]};
 const data={...part,views:{...part.views,iso}};
 for(const orientation of ['portrait','landscape'])for(const linkedProjections of [false,true]){
  const settings={...options,orientation,isoMode:'full',linkedProjections,viewPriority:'front'};
  const result=optimizeDrawingLayout(data,{options:settings,isoOnRight:true,dimensions:[frontDimension]});
  const {boxes,area,positions,scale}=result;
  const rightmost=boxes.find(box=>box.key==='iso');
  assert(boxes.every(box=>box===rightmost||box.x+box.width<=rightmost.x-2.99));
  for(const a of boxes){
   assert(a.x>=area.x-1e-8&&a.y>=area.y-1e-8&&a.x+a.width<=area.x+area.width+1e-8&&a.y+a.height<=area.y+area.height+1e-8);
   assert(!boxes.some(b=>a!==b&&a.x<b.x+b.width-1e-8&&b.x<a.x+a.width-1e-8&&a.y<b.y+b.height-1e-8&&b.y<a.y+a.height-1e-8));
  }
  if(linkedProjections){
   const {front,top,right}=drawingSheet(data,scale,true,result.dimensions,'',{...settings,layout:'compact',positions}).layout;
   assert(Math.abs(top.x+top.width/2-front.x-front.width/2)<1e-8);
   assert(Math.abs(right.y+right.height/2-front.y-front.height/2)<1e-8);
   assert(top.y+top.height<front.y&&right.x>front.x+front.width);
   const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale,hidden:true,comment:'',dimensions:result.dimensions,options:{...settings,positions}};
   assert.equal(readDrawingState(saved).options.linkedProjections,true);
   assert.throws(()=>readDrawingState({...saved,options:{...saved.options,linkedProjections:'on'}}));
  }
 }
});

test('page scales and resized PDF views are independent of the editor scale',()=>{
 const assigned={pageCount:2,views:{front:2,'section-a':2},comments:{}};
 const config={...options,pdfLayout:'manual',pageAssignments:assigned,pdfPageScales:{1:.5,2:.375},pdfViewScales:{'section-a':.6}};
 const editor=drawingSheet(part,1,true,[frontDimension],'',config);
 for(const placement of ['keep','auto']){
  const [first,second]=drawingPDFPages(part,1,true,[frontDimension],'',{...config,pdfPlacement:placement},editor);
  assert.equal(first.pageScale,.5);
  assert.equal(second.pageScale,.375);
  assert.equal(first.layout.top.width,30);
  assert.equal(second.layout.front.width,22.5);
  assert.equal(second.layout['section-a'].width,24);
  assert.deepEqual(second.dimensions[0].b,frontDimension.b);
  assert.ok(Math.abs(second.dimensions[0].at[1]*.375-frontDimension.at[1])<1e-9);
  assert.equal(header(first),'SCALE 1:2 / mm');
  assert.equal(header(second),'縮尺は各図に記載 / mm');
 }
 assert.equal(editor.layout.top.scale,1);
 assert.equal(editor.layout['section-a'].width,40);
 const state={version:1,signature:'scales',targets:['part'],targetMode:'visible',scale:.37,hidden:true,comment:'',dimensions:[],options:config};
 assert.deepEqual(readDrawingState(state),state);
 assert.throws(()=>readDrawingState({...state,options:{...config,pdfPageScales:{33:1}}}));
 assert.throws(()=>readDrawingState({...state,options:{...config,pdfViewScales:{'section-missing':1}}}));
});

test('a fixed PDF scale stays editable when the shapes overflow',()=>{
 const [first,second]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',pdfPlacement:'auto',pdfPageScales:{1:7,2:.5}});
 assert.equal(first.layout.front.scale,7);
 assert.equal(second.layout['section-a'].scale,.5);
 assert.ok(first.layout.front.x+first.layout.front.width>first.width);
});

test('page order edits remap every item and the corresponding scale settings',()=>{
 const assignments={pageCount:3,views:{front:1,right:1,left:3},comments:{comment:2},holeTable:2};
 const scales={1:.9,2:.5,3:.3};
 const pages=drawingPDFPages(part,1,true,[frontDimension],'工場向け',{...options,pdfLayout:'manual',
  pageAssignments:assignments,pdfPageScales:scales});
 const moved=remapDrawingPDFPages(pages,[1,0,2,null],assignments,scales);
 assert.deepEqual(moved,{assignments:{pageCount:4,views:{front:2,top:2,right:2,'section-a':1,left:3},
  comments:{comment:1},holeTable:1},scales:{1:.5,2:.9,3:.3}});
 const removed=remapDrawingPDFPages(pages,[0,1],assignments,scales);
 assert.equal(removed.assignments.views.left,2);
 assert.deepEqual(removed.scales,{1:.9,2:.5});
});
