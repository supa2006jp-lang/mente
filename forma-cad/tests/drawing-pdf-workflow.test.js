import assert from 'node:assert/strict';
import {test} from 'node:test';
import {autoDrawingDimensions,hideDuplicateOverallDimensions} from '../src/drawing-auto-dimensions.js';
import {drawingPDFHasMultiplePages,drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingPDFIssues} from '../src/drawing-sheet-check.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {readDrawingState} from '../src/drawing-state.js';
import {minDrawingScale,maxDrawingScale,parseDrawingScale,snapDrawingResizeScale,stepDrawingScale} from '../src/drawing-view-preferences.js';

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
 const resize=(start,target)=>snapDrawingResizeScale(start,target,minDrawingScale,maxDrawingScale);
 assert.equal(resize(1,1.04),1);
 assert.equal(resize(1,1.06),1.1);
 assert.equal(resize(1,.94),.9);
 assert.equal(resize(.43,.43),.43);
 assert.equal(resize(.43,.44),.43);
 assert.equal(resize(.43,.46),.5);
 assert.equal(resize(.1,.04),.1);
 assert.equal(resize(.05,.045),.045);
 assert.equal(snapDrawingResizeScale(.4,.67,.1,.65),.6);
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
