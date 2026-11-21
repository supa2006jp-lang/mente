import assert from 'node:assert/strict';
import test from 'node:test';
import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {readDrawingState} from '../src/drawing-state.js';
import {pruneDetailDimensionPlacements} from '../src/drawing-detail-dimensions.js';
import {snapDrawingDragAxis} from '../src/drawing-placement-guides.js';

const data={bodyCount:1,bounds:[[0,0,0],[40,25,20]],views:{
 top:{viewBox:[0,-25,40,25],visible:['M 0 0 L 40 0 L 40 -25 L 0 -25 Z'],hidden:[]},
}};
const detail={id:'detail-a',view:'top',center:[10,-8],radius:8,factor:2.75};
const options={paper:'A4',orientation:'landscape',frame:false,name:'詳細図',material:'',date:'',
 viewSelection:['top'],isoMode:'hidden',details:[detail],positions:{}};
const width={kind:'horizontal',view:'top',a:[6,-8],b:[14,-8],at:[10,18],displayValue:8.25};
const height={kind:'vertical',view:'top',a:[12,-11],b:[12,-5],at:[20,-8]};
const labels=svg=>[...svg.matchAll(/data-detail-dimension="detail-a"[^>]*>[^]*?<text[^>]*>([^<]+)<\/text>/g)].map(([,label])=>label);

test('the enlargement inherits complete dimensions and preserves their displayed values',()=>{
 const crossing={...width,a:[10,-8],b:[30,-8],displayValue:20};
 const hidden={...width,a:[7,-8],b:[13,-8],hidden:true};
 const circle={kind:'diameter',view:'top',center:[10,-8],radius:2,at:[12,-7]};
 const grouped={...circle,count:2,centers:[[10,-8],[30,-8]]};
 const own={...height,view:detail.id,a:height.b,b:height.a};
 const dimensions=[width,height,crossing,hidden,circle,grouped,own];
 const before=structuredClone(dimensions);
 const sheet=drawingSheet(data,1,true,dimensions,'',options);
 assert.deepEqual(labels(sheet.svg),['8.25','Ø4']);
 assert.equal(sheet.layout[detail.id].scale,2.75);
 assert.deepEqual(dimensions,before);
});

test('a decimal detail factor and its inherited dimensions survive separate PDF pages',()=>{
 const state={version:1,signature:'part',targetMode:'visible',targets:['part'],scale:1,hidden:true,comment:'',dimensions:[width],options};
 assert.equal(readDrawingState(state).options.details[0].factor,2.75);
 assert.throws(()=>readDrawingState({...state,options:{...options,details:[{...detail,factor:0}]}}));
 const [overview,enlargement]=drawingPDFPages(data,1,true,[width],'',{
  ...options,pdfLayout:'manual',pdfPlacement:'auto',pdfPageScales:{1:1,2:.8},pageAssignments:{pageCount:2,views:{top:1,[detail.id]:2}},
 });
 assert.deepEqual(labels(overview.svg),[]);
 assert.deepEqual(labels(enlargement.svg),['8.25']);
 assert(!enlargement.layout.top);
 assert.equal(enlargement.layout[detail.id].scale,2.2);
 assert.deepEqual(enlargement.dimensionIndices,[]);
});

test('positions belong to a detail and its PDF page, while values follow the source dimension',()=>{
 const original=drawingSheet(data,1,true,[width],'',options);
 const key=original.inheritedDimensions[0].detailDimensionKey;
 const overview={at:[10,1],alongOffset:4},pdf={at:[10,4]};
 const adjusted={...detail,dimensionPlacements:{[key]:{overview,pdf}}};
 const sibling={...detail,id:'detail-b'};
 const dimensions=[{...width,at:[10,20],alongOffset:8,displayValue:8.5}];
 const settings={...options,details:[adjusted,sibling]};
 const draft=drawingSheet(data,1,true,dimensions,'',settings);
 const [a,b]=draft.inheritedDimensions;
 assert.deepEqual(a.at,overview.at);
 assert.equal(a.alongOffset,4);
 assert.equal(a.displayValue,8.5);
 assert.notDeepEqual(b.at,overview.at);
 assert.deepEqual(draft.dimensions,dimensions);

 const state={version:1,signature:'part',targetMode:'visible',targets:['part'],scale:1,hidden:true,comment:'',dimensions,options:settings};
 assert.deepEqual(readDrawingState(state).options.details[0].dimensionPlacements,{[key]:{overview,pdf}});
 const [sourcePage,detailPage]=drawingPDFPages(data,1,true,dimensions,'',{
  ...settings,pdfLayout:'manual',pageAssignments:{pageCount:2,views:{top:1,[detail.id]:2}},
 });
 assert.deepEqual(sourcePage.dimensions,dimensions);
 assert.deepEqual(detailPage.inheritedDimensions[0].at,pdf.at);
 assert.equal(detailPage.inheritedDimensions[0].alongOffset,undefined);
 assert.equal(detailPage.inheritedDimensions[0].displayValue,8.5);
 assert.deepEqual(pruneDetailDimensionPlacements(settings.details,[])[0].dimensionPlacements,{});
 const invalid={...state,options:{...settings,details:[{...detail,dimensionPlacements:{[key]:{overview:{at:[0,null]}}}}]}};
 assert.throws(()=>readDrawingState(invalid));
});

test('drawing drag snaps to the nearby axis at different zoom levels',()=>{
 assert.deepEqual(snapDrawingDragAxis([10,1],[4,4]),{delta:[10,0],axis:1});
 assert.deepEqual(snapDrawingDragAxis([.5,-5],[8,8]),{delta:[0,-5],axis:0});
 assert.deepEqual(snapDrawingDragAxis([3,3],[4,4]),{delta:[3,3],axis:null});
 assert.deepEqual(snapDrawingDragAxis([10,2.5],[4,4],1),{delta:[10,0],axis:1});
 assert.deepEqual(snapDrawingDragAxis([10,3.3],[4,4],1),{delta:[10,3.3],axis:null});
});
