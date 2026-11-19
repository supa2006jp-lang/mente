import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drawingDimensionPointFits,snapDrawingDimensionPoint} from '../src/drawing-dimension-points.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from '../src/drawing-dimension-references.js';
import {followSectionEdit} from '../src/drawing-section-references.js';
import {readDrawingState} from '../src/drawing-state.js';

const view={viewBox:[0,0,50,30],visible:['M 10 2 L 10 23'],hidden:['M 3 8 L 41 8']};

test('dimension point placement snaps to nearby intersections and displayed hidden lines',()=>{
 assert.deepEqual(snapDrawingDimensionPoint(view,[10.2,8.4],1,{hidden:true}),[10,8]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[10.2,8.4],1),[10,8.4]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[20.2,8.4],1,{hidden:true}),[20.2,8]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[20.2,8.4],1),[20.2,8.4]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[10.2,8.4],1,{hidden:true,accept:p=>p[1]!==8}),[10,8.4]);
 const arc={...view,visible:['M 30 15 A 5 5 0 0 1 20 15']};
 assert.deepEqual(snapDrawingDimensionPoint(arc,[25,20.4],1),[25,20]);
 const clipped={...view,clip:{center:[10,8],radius:2}};
 assert.equal(drawingDimensionPointFits(clipped,[10,10]),true);
 assert.equal(drawingDimensionPointFits(clipped,[10,10.1]),false);
});

test('saved manual points and dimension endpoints coexist with older drawing data',()=>{
 const corner={view:'front',kind:'horizontal',a:[0,0],b:[12,-3],at:[6,6],manualEndpoints:['b']};
 const manual={id:'dimension-point-test',view:'front',point:corner.b};
 const state={version:1,signature:'test',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',
  dimensions:[corner],dimensionPoints:[manual],options:{paper:'A4',orientation:'landscape',frame:true,
   name:'',material:'',date:'',positions:{}}};
 assert.deepEqual(readDrawingState(state),state);
 const old=structuredClone(state);delete old.dimensionPoints;delete old.dimensions[0].manualEndpoints;
 assert.deepEqual(readDrawingState(old),old);
 assert.throws(()=>readDrawingState({...state,dimensionPoints:[manual,manual]}));
 assert.throws(()=>readDrawingState({...state,dimensionPoints:[{...manual,view:'iso'}]}));
 assert.throws(()=>readDrawingState({...state,dimensions:[{...corner,manualEndpoints:['b','b']}]}));
});

test('manual endpoints retain their coordinates when the outline is recalculated',()=>{
 const projection=width=>({bounds:[[0,0,0],[width,20,20]],views:{front:{
  viewBox:[0,-20,width,20],visible:[`M 0 0 L ${width} 0 L ${width} -20 L 0 -20 Z`],hidden:[]
 }}});
 const dimension={view:'front',kind:'horizontal',a:[40,0],b:[12,-3],at:[26,6],manualEndpoints:['b']};
 const refs=captureDrawingReferences(projection(40),[dimension]);
 const updated=reconcileDrawingDimensions(projection(50),[dimension],refs)[0];
 assert.deepEqual(updated,{...dimension,a:[50,0],at:[31,6]});
 assert.equal(reconcileDrawingDimensions(projection(8),[dimension],refs)[0].review,true);
 assert.equal(reconcileDrawingDimensions(projection(40),[dimension],refs,{targetsChanged:true})[0].review,true);
});

test('reversing a section mirrors its manual points and the dimensions that use them',()=>{
 const section={id:'section-a',view:'top',orientation:'vertical',coordinate:10,reverse:false};
 const geometry=sign=>({bounds:[[0,0,0],[40,25,20]],views:{[section.id]:{
  viewBox:[sign<0?-10:0,0,10,10],visible:[`M 0 0 L ${sign*10} 0 L ${sign*10} 10 L 0 10 Z`],hidden:[]
 }}});
 const point={id:'dimension-point-section',view:section.id,point:[4,5]};
 const dimension={view:section.id,kind:'horizontal',a:[0,0],b:point.point,at:[2,-2],manualEndpoints:['b']};
 const next=followSectionEdit(geometry(1),geometry(-1),section,{...section,reverse:true},{
  dimensions:[dimension],details:[],markers:[],leaders:[],dimensionPoints:[point]
 });
 assert.deepEqual(next.dimensionPoints,[{...point,point:[-4,5]}]);
 assert.deepEqual(next.dimensions,[{...dimension,b:[-4,5],at:[-2,-2]}]);
});
