import assert from 'node:assert/strict';
import {test} from 'node:test';
import {autoDrawingDimensions,hideDuplicateOverallDimensions} from '../src/drawing-auto-dimensions.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingPDFIssues} from '../src/drawing-sheet-check.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {readDrawingState} from '../src/drawing-state.js';

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
