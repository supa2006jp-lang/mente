import assert from 'node:assert/strict';
import {groupDrawingDimensions} from '../src/drawing-dimension-groups.js';
import {editDrawingDimensions} from '../src/drawing-dimension-list.js';
import {dimensionLabel,dimensionSVG} from '../src/drawing-dimensions.js';
import {autoDrawingDimensions} from '../src/drawing-auto-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {readDrawingState} from '../src/drawing-state.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from '../src/drawing-dimension-references.js';
const radius=(x,extra={})=>({view:'top',kind:'radius',center:[x,5],radius:2,arcPoint:[x+Math.SQRT2,5+Math.SQRT2],at:[x+8,10],...extra});
const source=[radius(2),radius(20),radius(30,{radius:2.0002}),radius(40,{textColor:'#ff0000'}),radius(50,{view:'front'}),radius(60,{hidden:true}),radius(70,{review:true})],before=structuredClone(source);
const grouped=groupDrawingDimensions(source);assert.equal(grouped.length,6);assert.equal(dimensionLabel(grouped[0]),'2×R2');assert.deepEqual(grouped[0].centers,[[2,5],[20,5]]);assert.deepEqual(source,before);assert.deepEqual(groupDrawingDimensions(grouped),grouped);
assert.equal(groupDrawingDimensions([radius(2),radius(2)]).length,2,'the same feature is not counted twice');
assert.equal(groupDrawingDimensions([radius(2,{tolerance:.1}),radius(20,{tolerance:.2})]).length,2,'different tolerances remain separate');
const edited=editDrawingDimensions(source,[0,1],{fontSize:5,textColor:'#123456',hidden:true});assert.equal(edited[0].fontSize,5);assert.equal(edited[1].textColor,'#123456');assert.strictEqual(edited[2],source[2]);assert.deepEqual(source,before);assert.equal(dimensionSVG(edited[0],{x:0,y:0,bx:0,by:0,scale:1,width:100,height:100},1,0),'');
const shown=editDrawingDimensions(edited,[0],{hidden:false,textColor:null});assert.equal(shown[0].hidden,undefined);assert.equal(shown[0].textColor,undefined);assert(shown[1].hidden);
for(const patch of [{radius:10},{fontSize:.1},{hidden:'true'},{textColor:'javascript:'}])assert.throws(()=>editDrawingDimensions(source,[0],patch));assert.throws(()=>editDrawingDimensions(source,[-1],{hidden:true}));
const outline='M 0 -20 L 0 -5 A 5 5 0 0 0 5 0 L 35 0 A 5 5 0 0 0 40 -5 L 40 -25 L 0 -25 Z',circle=x=>`M ${x+2} -12 A 2 2 0 0 1 ${x-2} -12 A 2 2 0 0 1 ${x+2} -12 Z`;
const data={bounds:[[0,0,0],[40,25,20]],bodyCount:1,views:{top:{visible:[outline,circle(10),circle(30)],hidden:[]},front:{visible:['M 0 0 L 40 0 L 40 -20 L 0 -20 Z'],hidden:[]},right:{visible:['M 0 0 L 25 0 L 25 -20 L 0 -20 Z'],hidden:[]}}},sheet=drawingSheet(data,1,true,[],'',{viewSelection:['top'],isoMode:'hidden'});
for(const [types,expected] of [[['radius'],['radius']],[['diameter'],['diameter']],[['horizontal','vertical'],['horizontal','vertical']],[[],[]]]){const dims=autoDrawingDimensions(data,1,[],sheet,{types}).dimensions;assert.deepEqual([...new Set(dims.map(d=>d.kind))].sort(),[...expected].sort());}
const dims=autoDrawingDimensions(data,1,[],sheet,{types:['radius','diameter']}).dimensions;assert.equal(dimensionLabel(dims.find(d=>d.kind==='radius')),'2×R5');assert.equal(dimensionLabel(dims.find(d=>d.kind==='diameter')),'2×Ø4');assert.equal(autoDrawingDimensions(data,1,dims,sheet,{types:['radius','diameter']}).dimensions.length,0,'grouped R membership is deduplicated');
const individual=autoDrawingDimensions(data,1,[],sheet,{types:['radius','diameter'],groupRepeated:false}).dimensions;assert.equal(individual.length,4);assert(individual.every(d=>!d.count));
const state={version:1,signature:'test',dimensions:editDrawingDimensions(dims,[0],{hidden:true}),scale:1,hidden:true,comment:'',targets:['part'],targetMode:'visible',options:{paper:'A4',orientation:'landscape',frame:true,name:'',material:'',date:'',positions:{},autoDimensionTypes:['radius','diameter'],groupRepeatedDimensions:false}};
assert.deepEqual(readDrawingState(state),state);
for(const corrupt of [s=>s.options.autoDimensionTypes=['radius','radius'],s=>s.options.autoDimensionTypes=['anything'],s=>s.options.groupRepeatedDimensions=1,s=>s.dimensions[0].hidden=1,s=>s.dimensions[0].count=3,s=>s.dimensions[0].centers[1]=s.dimensions[0].centers[0]]){const bad=structuredClone(state);corrupt(bad);assert.throws(()=>readDrawingState(bad));}
const reference=captureDrawingReferences(data,dims),tracked=reconcileDrawingDimensions(data,dims,reference);assert(!tracked.some(d=>d.review));const removed=structuredClone(data);removed.views.top.visible=[outline,circle(10)];assert(reconcileDrawingDimensions(removed,dims,reference).find(d=>d.kind==='diameter').review,'missing group members cannot retain a stale count');
const extra={...data,views:{...data.views,'section-check':data.views.top}},extraSheet={...sheet,layout:{'section-check':sheet.layout.top}};assert.equal(autoDrawingDimensions(extra,1,[],extraSheet,{types:[]}).dimensions.length,0,'global types also apply to sections');
console.log('PASS grouped R and diameter identity/style, global categories, individual mode, batch-only presentation edits, hidden SVG, save validation and grouped reference recovery');
