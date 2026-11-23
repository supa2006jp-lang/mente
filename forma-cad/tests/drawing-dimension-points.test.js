import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drawingDimensionCenterGuides,drawingDimensionPointFits,snapDrawingDimensionPoint as snapTarget} from '../src/drawing-dimension-points.js';
import {dimensionLabel,dimensionValue,drawingDimensionGeometry,pathEndpoints} from '../src/drawing-dimensions.js';
import {viewPoints} from '../src/drawing-annotations.js';
import {drawingDimensionBetween,replaceDrawingDimensionEndpoint} from '../src/drawing-linear-dimensions.js';
import {captureDrawingReferences,reconcileDrawingDimensions,reconcileDrawingHolePoints} from '../src/drawing-dimension-references.js';
import {resolveDrawingHoleCenter} from '../src/drawing-hole-references.js';
import {followSectionEdit} from '../src/drawing-section-references.js';
import {readDrawingState} from '../src/drawing-state.js';

const view={viewBox:[0,0,50,30],visible:['M 10 2 L 10 23'],hidden:['M 3 8 L 41 8']};
const snapDrawingDimensionPoint=(...args)=>snapTarget(...args).point;
const centerPoints=(...args)=>drawingDimensionCenterGuides(...args).map(guide=>guide.point);

test('dimension targets keep straight-run ends, junctions and arc anchors when a radius projects to many segments',()=>{
 const visible=[
  'M 0 0 L 0 -20 L .03144 -20 L .12536 -20 L .28058 -20 L 1.09084 -20 L 5 -20 L 47 -20',
  'M 5 -20 L 5 0',
  'M 8 0 L 9 0 L 10 0',
  'M 11 -1 A 1 1 0 0 1 13 -1 A 1 1 0 0 1 11 -1',
 ];
 assert.deepEqual(viewPoints({visible}),[
  [0,0],[0,-20],[47,-20],[5,-20],[5,0],[8,0],[9,0],[10,0],[11,-1],[13,-1],[12,-1],
 ]);
 assert.deepEqual(viewPoints({visible,clip:{center:[5,-20],radius:1}}),[[5,-20]]);
 assert.ok(pathEndpoints(visible).some(([x,y])=>x===.12536&&y===-20));
});

test('rounded diagonal straight runs omit interior samples while retaining reversals and small corners',()=>{
 const visible=['M 0 0 L .3 .10001 L .6 .2 L .9 .3 L 1.2 .4 L .9 .3 L .9 .2999 L .8999 .2999'];
 assert.deepEqual(viewPoints({visible}),[[0,0],[1.2,.4],[.9,.3],[.9,.2999],[.8999,.2999]]);
});

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

test('manual dimension points can snap along an edge without locking to its drawing subdivisions',()=>{
 const visible=['M 0 0 L 1 0 L 2 0 L 3 0 L 4 0 L 8 0','M 4 0 L 4 5'];
 const model={viewBox:[0,0,8,5],visible};
 assert.deepEqual(snapDrawingDimensionPoint(model,[2.1,.2],.4),[2.1,0]);
 assert.deepEqual(snapDrawingDimensionPoint(model,[4.1,.2],.5),[4,0]);
});

const ring=(x,y,r)=>`M ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y}`;

test('center guides deduplicate concentric rounds, prefer machining coordinates and follow hidden lines and detail clips',()=>{
 const bore=[20.00002,10];
 const source={viewBox:[0,0,50,30],
  visible:[ring(20,10,2),ring(20,10,4),ring(8,10,2),'M 42 12 A 2 2 0 0 1 38 12','M 29 7 A 2 2 0 0 1 31 9'],
  hidden:[ring(33,22,1),'M 38 12 A 2 2 0 0 1 42 12'],
  holeMachining:[{center:bore,radius:2,counterbore:{radius:4}},{center:[33,22],radius:1},{center:[15,22],radius:1}],
 };
 assert.deepEqual(centerPoints(source),[bore,[8,10]]);
 assert.deepEqual(centerPoints(source,true),[bore,[33,22],[8,10],[40,12]]);
 assert.deepEqual(centerPoints({...source,clip:{center:[20,10],radius:5}},true),[bore]);
 assert.deepEqual(drawingDimensionCenterGuides(source).map(guide=>guide.label),['穴中心 Ø4','円中心 Ø4']);
});

test('a manual point snaps to the hole center or the nearby rim according to cursor position',()=>{
 const small={viewBox:[0,0,30,20],visible:[ring(20,10,1)]};
 assert.deepEqual(snapDrawingDimensionPoint(small,[20.21,10.16],1),[20,10]);
 assert.deepEqual(snapDrawingDimensionPoint(small,[20.85,10],1),[21,10]);
 assert.deepEqual(snapDrawingDimensionPoint(small,[20.21,10.16],1,{guide:[9,9.8]}),[20,10]);
 assert.notDeepEqual(snapDrawingDimensionPoint(small,[20.21,10.16],1,{accept:p=>p[0]!==20}),[20,10]);
 const hidden={...small,visible:[],hidden:small.visible};
 assert.deepEqual(snapDrawingDimensionPoint(hidden,[20.21,10.16],1),[20.21,10.16]);
 assert.deepEqual(snapDrawingDimensionPoint(hidden,[20.21,10.16],1,{hidden:true}),[20,10]);
 assert.equal(snapTarget(small,[20.21,10.16],1).label,'円中心 Ø2');
 assert.equal(snapTarget(small,[20,10.92],.4).label,'円周');
 assert.equal(snapTarget(small,[10,10.92],.4).label,'自由点');
});

test('a slot center comes from two facing semicircles joined by both straight sides',()=>{
 const caps=['M 22 7 A 3 3 0 0 1 22 13','M 10 13 A 3 3 0 0 1 10 7'];
 const firstSide='M 10 7 L 15 7 L 22 7',secondSide='M 10 13 L 22 13';
 const slot={viewBox:[0,0,45,25],visible:[...caps,firstSide,secondSide,ring(33,10,2)]};
 assert.deepEqual(centerPoints(slot),[[33,10],[16,10]]);
 const {point,label}=snapTarget(slot,[16.2,9.8],1);
 assert.deepEqual({point,label},{point:[16,10],label:'長穴中心'});
 assert.deepEqual(centerPoints({...slot,visible:[...caps,firstSide]}),[]);
 assert.deepEqual(centerPoints({...slot,visible:[ring(10,10,3),ring(22,10,3),firstSide,secondSide]}),[[10,10],[22,10]]);
 const partial={...slot,visible:[...caps,firstSide],hidden:[secondSide]};
 assert.deepEqual(centerPoints(partial),[]);
 assert.deepEqual(centerPoints(partial,true),[[16,10]]);
 const angle=.37,rotate=(x,y)=>[(x*Math.cos(angle)-y*Math.sin(angle)).toFixed(5),(x*Math.sin(angle)+y*Math.cos(angle)).toFixed(5)].join(' ');
 const slanted={viewBox:[-2,-2,80,40],visible:[`M ${rotate(0,-.1)} L ${rotate(75,-.1)} A .1 .1 0 0 1 ${rotate(75,.1)} L ${rotate(0,.1)} A .1 .1 0 0 1 ${rotate(0,-.1)} Z`]};
 const [center]=centerPoints(slanted);
 assert.ok(Math.hypot(center[0]-37.5*Math.cos(angle),center[1]-37.5*Math.sin(angle))<1e-4);
});

test('hole point and dimension endpoints follow operation IDs, including swapped holes, while missing sources require review',()=>{
 const sourceId={sourceId:'bore-a'},threadRef={threadRef:{id:'thread',bodyId:'part',end:'high'}};
 const original={id:'dimension-point-hole',view:'top',point:[10,8],holeRef:sourceId};
 const measure=drawingDimensionBetween('horizontal','top',{point:original.point,manual:true,holeRef:sourceId},{point:[24,9],holeRef:threadRef});
 const d={...measure,at:[18,21],pdfPlacement:{at:[18,23]},lineColor:'#765390'};
 const data={views:{top:{viewBox:[0,0,45,25],visible:[]}},bounds:[[0,-25,0],[45,0,8]]};
 const moved=[
  {center:[24,12],sourceId:'bore-a'},
  {center:[10,8],sourceId:'neighbor'},
  {center:[31,9],machining:{thread:threadRef.threadRef}},
 ];
 const resolve=(name,ref)=>name==='top'?resolveDrawingHoleCenter(moved,ref):null;
 const [point]=reconcileDrawingHolePoints([original],resolve);
 assert.deepEqual(point,{...original,point:[24,12]});
 const [current]=reconcileDrawingDimensions(data,[d],{},{resolveHoleCenter:resolve});
 assert.deepEqual(current,{...d,a:[24,12],b:[31,9],at:[28.5,23],pdfPlacement:{at:[28.5,25]}});
 assert.equal(dimensionLabel(current),'7');
 const deleted=(name,ref)=>resolveDrawingHoleCenter(moved.slice(1),ref);
 const [orphan]=reconcileDrawingHolePoints([point],deleted);
 const [warning]=reconcileDrawingDimensions(data,[current],{},{resolveHoleCenter:deleted});
 assert.deepEqual(orphan,{...point,review:true});
 assert.equal(dimensionLabel(warning),'要確認');
 assert.deepEqual(reconcileDrawingHolePoints([orphan],resolve),[point]);
 assert.deepEqual(reconcileDrawingDimensions(data,[warning],{},{resolveHoleCenter:resolve}),[current]);
 const changed=replaceDrawingDimensionEndpoint(current,'a',{point:[21,12]});
 assert.deepEqual(changed.holeRefs,{b:threadRef});
 assert.equal(changed.manualEndpoints,undefined);
});

test('guide snapping aligns one coordinate and intersects nearby straight and round edges',()=>{
 const guide=[6,12];
 assert.deepEqual(snapDrawingDimensionPoint(view,[19.8,12.3],1,{guide}),[19.8,12]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[6.2,20.2],1,{guide}),[6,20.2]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[5.9,12.3],1,{guide}),[6,12.3]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[10.25,12.35],1,{guide}),[10,12]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[6.2,8.17],1,{guide,hidden:true}),[6,8]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[12,8.2],1,{guide:[3,8.5],hidden:true}),[12,8]);
 assert.deepEqual(snapDrawingDimensionPoint(view,[10.25,12.35],1,{guide,accept:p=>p[1]!==12}),[10,12.35]);
 const arc={...view,visible:['M 30 15 A 5 5 0 0 1 20 15']};
 assert.deepEqual(snapDrawingDimensionPoint(arc,[25.4,20.25],1,{guide:[25,10]}),[25,20]);
});

test('a manual value controls the printed dimension label and preserves the measured distance',()=>{
 const measured={view:'front',kind:'horizontal',a:[0,0],b:[30.0015,0],at:[15,8],precision:4};
 assert.equal(dimensionLabel(measured),'30.0015');
 const corrected={...measured,precision:undefined,displayValue:30};
 assert.equal(dimensionLabel(corrected),'30');
 assert.equal(dimensionValue(corrected),30.0015);
 assert.equal(dimensionLabel({...corrected,tolerance:.1,note:'仕上げ'}),'30 ±0.1 仕上げ');
 assert.equal(dimensionLabel({...corrected,displayValue:30.1234}),'30.1234');
 assert.equal(dimensionLabel({...corrected,precision:2}),'30.00');
 const layout={x:20,y:50,bx:0,by:0,scale:2};
 assert.deepEqual(drawingDimensionGeometry(corrected,layout),drawingDimensionGeometry(measured,layout));
});

test('short linear dimensions put both arrow bases and the label outside the measured span',()=>{
 const d={view:'front',kind:'horizontal',a:[0,0],b:[3,0],at:[1.5,6]};
 const layout={x:20,y:50,bx:0,by:0,scale:1,width:40,height:20};
 const outside=drawingDimensionGeometry(d,layout);
 assert.equal(outside.outside,true);
 assert.deepEqual(outside.arrows.map(arrow=>arrow[0]),[[20,56],[23,56]]);
 assert.equal(outside.arrows[0][1][0],18);
 assert.equal(outside.arrows[1][1][0],25);
 assert.ok(outside.at[0]>outside.main[0][1][0]);
 assert.equal(outside.at[1],56);
 const inside=drawingDimensionGeometry(d,{...layout,scale:4,width:160,height:80});
 assert.ok(!inside.outside);
 assert.equal(inside.at[0],26);
 assert.equal(dimensionLabel(d),'3');
});

test('replacing a single endpoint recalculates the measurement and retains the placement and formatting',()=>{
 const before={view:'front',kind:'vertical',a:[0,0],b:[12,3],at:[19,3],alongOffset:2,pinned:true,precision:1,
  displayValue:3.5,fontSize:3.4,note:'端',tolerance:.2,lineColor:'#123456',textColor:'#654321',
  automatic:true,overall:'z',manualEndpoints:['b'],pdfPlacement:{at:[20,3],alongOffset:1}};
 assert.equal(replaceDrawingDimensionEndpoint(before,'b',{point:[12,3],manual:true}),before);
 assert.equal(replaceDrawingDimensionEndpoint(before,'b',{point:[1,0]}),null);
 const next=replaceDrawingDimensionEndpoint(before,'a',{point:[5,-21],manual:true});
 const {displayValue,automatic,overall,...retained}=before;
 assert.deepEqual(next,{...retained,a:[5,-21],manualEndpoints:['a','b']});
 assert.equal(dimensionLabel(next),'24.0 ±0.2 端');
 assert.equal(before.displayValue,3.5);
 const iso={view:'iso',kind:'aligned',a:[0,0],b:[1,1],at:[3,2],modelA:[0,0,0],modelB:[2,0,0]};
 const longer=replaceDrawingDimensionEndpoint(iso,'b',{point:[2,1],model:[3,4,0]});
 assert.deepEqual(longer.modelA,iso.modelA);
 assert.equal(dimensionValue(longer),5);
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
 const corrected={...state,dimensions:[{...corner,displayValue:12.5}]};
 assert.deepEqual(readDrawingState(corrected),corrected);
 for(const bad of [0,-1,NaN,Infinity,'30']){
  assert.throws(()=>readDrawingState({...state,dimensions:[{...corner,displayValue:bad}]}));
 }
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
