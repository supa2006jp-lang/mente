import assert from 'node:assert/strict';
import {test} from 'node:test';
import {holeReferenceInventory,lastHoleNumber,reconcileHoleTable,unlistedDrawingHoles} from '../src/drawing-hole-references.js';
import {readDrawingState} from '../src/drawing-state.js';
import {drawingHoleMarkers,resolveDrawingHoleTable,drawingHoleTableSVG,drawingHoleTableSize} from '../src/drawing-hole-table.js';
import {followSectionEdit} from '../src/drawing-section-references.js';
import {alignThirdAngleViews,isThirdAngleLayout,projectDrawingIsometric} from '../src/drawing-view-preferences.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from '../src/drawing-dimension-references.js';
import {dimensionLabel,dimensionValue} from '../src/drawing-dimensions.js';
import {overallDrawingDimensions,reconcileAutomaticOverallDimensions} from '../src/drawing-auto-dimensions.js';

const hole=(x,sourceId,radius=2.5)=>({center:[x,0],radius,...(sourceId?{sourceId}:{})});
const table=(holes,all=holes)=>({view:'top',origin:[0,0],holes,references:holeReferenceInventory(all)});
const box=[0,0,60,24];
test('appending retains issued numbers, excludes listed rims and keeps unresolved rows available for relinking',()=>{
 const legacy=table([hole(1),hole(3)]);
 assert.equal(lastHoleNumber(legacy),2);
 const old={...legacy,lastNumber:49,holes:[{...hole(1,'cut'),number:1},{...hole(3),number:48,review:true}]};
 const candidates=[hole(2,'cut'),{...hole(1,undefined,1.5),machining:{counterbore:{radius:2.5}}},hole(4)];
 assert.deepEqual(unlistedDrawingHoles(old,candidates),[hole(4)]);
 const next={...old,holes:[...old.holes,{...hole(4),number:lastHoleNumber(old)+1}],lastNumber:50};
 const state={version:1,signature:'test',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],
  options:{paper:'A4',orientation:'landscape',frame:true,name:'',material:'',date:'',positions:{},holeTable:next}};
 assert.deepEqual(readDrawingState(state).options.holeTable,next);
 next.lastNumber=48;
 assert.throws(()=>readDrawingState(state));
});
test('hole numbers follow source identities across swaps and diameter edits; a replacement requires review',()=>{
 const old=table([hole(1,'a'),hole(2,'b'),hole(3,'c')]);
 const next=reconcileHoleTable(old,[hole(2,'a',4),hole(1,'b'),hole(3,'new')],box);
 assert.deepEqual(next.holes.map(h=>[h.number,h.center[0],h.radius,!!h.review]),[[1,2,4,false],[2,1,2.5,false],[3,3,2.5,true]]);
 const view={x:0,y:0,bx:0,by:0,scale:1};
 assert.deepEqual(drawingHoleMarkers(next,view).map(m=>m.label),['O','H1','H2']);
 const resolved=resolveDrawingHoleTable(next,{top:{}});
 assert.match(drawingHoleTableSVG(resolved,{x:0,y:0,...drawingHoleTableSize(resolved,{top:true})}),/H3<\/text>.*?要確認/);
 assert.equal(old.holes[0].center[0],1);
});
test('unselected existing holes and ambiguous geometry never absorb another hole number',()=>{
 const tracked=table([hole(5),hole(15)],[hole(5),hole(15),hole(20)]);
 const moved=reconcileHoleTable(tracked,[hole(6),hole(15),hole(20)],box);
 assert.deepEqual(moved.holes.map(h=>[h.center[0],!!h.review]),[[6,false],[15,false]]);
 const removed=reconcileHoleTable(tracked,[hole(15),hole(20)],box);
 assert.equal(removed.holes[0].review,true);
 const ambiguous=reconcileHoleTable(tracked,[hole(4),hole(6),hole(15),hole(20)],box);
 assert.equal(ambiguous.holes[0].review,true);
 const changed=reconcileHoleTable(tracked,[hole(5),hole(15)],box,{targetsChanged:true});
 assert.ok(changed.holes.every(h=>h.review));
 assert.ok(reconcileHoleTable(changed,[hole(5),hole(15)],box).holes.every(h=>h.review));
 const legacy={view:'top',origin:[0,0],holes:[hole(5),hole(15)],review:true};
 const migrated=reconcileHoleTable(legacy,[hole(15)],box);
 assert.equal(migrated.review,undefined);assert.deepEqual(migrated.holes.map(h=>!!h.review),[true,false]);
});

const section={id:'section-a',view:'top',orientation:'vertical',coordinate:10,reverse:false};
const shape=(x,sign=1)=>({visible:[`M 0 0 L ${sign*x} 0 L ${sign*x} 10 L 0 10 Z`],hidden:[],viewBox:[sign<0?-x:0,0,x,10]});
const sectionData=v=>({views:{'section-a':v},bounds:[[0,0,0],[40,25,20]]});
test('section edit follows the measured edge, preserves annotations and flags missing references independently',()=>{
 const d={view:section.id,kind:'horizontal',feature:'profile-edge',a:[0,0],b:[10,0],at:[5,-3],automatic:true,pinned:true,tolerance:.1,note:'加工'};
 const details=[{id:'detail-a',view:section.id,center:[0,0],radius:18,factor:2}];
 const unrelated={...d,view:'front'},missing={...d,a:[4,8],b:[5,8],at:[2,4]};
 const leader={id:'leader-a',view:section.id,anchor:[10,0],at:[11,-3],text:'角'};
 const args={dimensions:[d,{...d,view:'detail-a'},missing,unrelated],details,leaders:[leader],markers:[]};
 const follow=(old,next,s2)=>followSectionEdit(sectionData(old),sectionData(next),section,s2,args);
 const changed=follow(shape(10),shape(11),{...section,coordinate:11});
 assert.deepEqual(changed.dimensions[0],{...d,b:[11,0],at:[5.5,-3]});
 assert.equal(changed.dimensions[1].b[0],11);assert.equal(changed.dimensions[2].review,true);
 assert.equal(changed.dimensions[3],unrelated);assert.deepEqual(changed.leaders[0].anchor,[11,0]);
 const reversed=follow(shape(10),shape(10,-1),{...section,reverse:true});
 assert.equal(reversed.dimensions[0].b[0],-10);assert.equal(reversed.dimensions[0].at[0],-5);
 assert.equal(reversed.dimensions[0].review,undefined);
});

test('third-angle lock anchors top, bottom and side projections and keeps unlocked misalignment identifiable',()=>{
 const v=(x,y,width,height)=>({x,y,width,height,scale:1});
 const layout={front:v(50,65,40,20),top:v(78,80,40,30),right:v(32,25,30,20),left:v(72,20,30,20),
  bottom:v(60,25,40,30),back:v(50,30,40,20),iso:v(123,43,50,40)};
 assert.equal(isThirdAngleLayout(layout),false);
 alignThirdAngleViews(layout,[50,65]);
 assert.equal(layout.top.x,50);assert.equal(layout.bottom.x,50);assert.equal(layout.right.y,65);
 assert.ok(layout.top.y+layout.top.height<layout.front.y);assert.ok(layout.bottom.y>85);
 assert.ok(layout.right.x>90);assert.ok(layout.back.x>layout.right.x+layout.right.width);
 assert.equal(isThirdAngleLayout(layout),true);assert.deepEqual(layout.iso,v(123,43,50,40));
 layout.top.x++;assert.equal(isThirdAngleLayout(layout),false);
});

test('isometric dimensions retain real vertex positions and require review when a vertex disappears',()=>{
 const a=[0,0],b=[0,-16.32993],modelA=[0,0,0],modelB=[0,0,20];
 const d={view:'iso',kind:'aligned',a,b,modelA,modelB,at:[-8,-8]};
 const state={version:1,signature:'iso',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',
  dimensions:[d],options:{paper:'A4',orientation:'landscape',frame:true,name:'',material:'',date:'',positions:{}}};
 assert.deepEqual(readDrawingState(state),state);
 assert.throws(()=>readDrawingState({...state,dimensions:[{...d,modelB:undefined}]}));
 assert.throws(()=>readDrawingState({...state,dimensions:[{...d,kind:'vertical'}]}));
 const data={views:{iso:{viewBox:[0,-20,45,40],dimensionVertices:[{point:a,model:modelA},{point:b,model:modelB}]}}};
 assert.deepEqual(captureDrawingReferences(data,[d]),{});
 assert.equal(dimensionLabel(reconcileDrawingDimensions(data,[d],{})[0]),'20');
 data.views.iso.dimensionVertices[1]={point:b,model:[1,-1,21]};
 assert.equal(dimensionLabel(reconcileDrawingDimensions(data,[d],{})[0]),'要確認');
});

function overallFixture(x,width){
 const modelA=[x,0,0],modelB=[x+width,0,0],a=projectDrawingIsometric(modelA),b=projectDrawingIsometric(modelB);
 const data={bounds:[[x,0,0],[x+width,40,24]],views:{front:shape(width),iso:{dimensionVertices:[{point:a,model:modelA},{point:b,model:modelB}]}}};
 const [front]=overallDrawingDimensions(data);
 const iso={view:'iso',kind:'aligned',overall:'iso-x',a,b,modelA,modelB,at:[8,-16]};
 return {data,dimensions:[front,iso].map(d=>({...d,automatic:true}))};
}

test('current auto overall dimensions retire stale duplicates on opening and retain their exact placements',()=>{
 const {data,dimensions}=overallFixture(-30,60);
 const [front,iso]=overallFixture(0,43).dimensions.map(d=>({...d,review:true}));
 const manual={...front,automatic:false},override={...front,displayValue:43};
 const styled={...iso,lineColor:'#2277aa'},pinned={...iso,pinned:true};
 dimensions[0].at=[17,31];dimensions[1].pdfPlacement={at:[12,-15]};
 const kept=[manual,override,styled,pinned,...dimensions];
 const result=reconcileAutomaticOverallDimensions(data,[front,iso,...kept],()=>1);
 assert.deepEqual(result,{dimensions:kept,removed:2,rebuilt:0});
 assert.equal(result.dimensions.at(-1),dimensions[1]);
 assert.deepEqual(reconcileAutomaticOverallDimensions(data,result.dimensions,()=>1),{dimensions:kept,removed:0,rebuilt:0});
});

test('replacing a target rebuilds plain auto overall dimensions only when the new geometry supports them',()=>{
 const old=overallFixture(0,43),{data}=overallFixture(-30,60);
 const oldIso=old.dimensions[1],modelB=[0,40,0];
 const unusable={...oldIso,overall:'iso-y',modelB,b:projectDrawingIsometric(modelB)};
 const annotated={...old.dimensions[0],note:'加工後',tolerance:.2};
 const pending=reconcileDrawingDimensions(data,[...old.dimensions,unusable,annotated],{},{targetsChanged:true});
 const result=reconcileAutomaticOverallDimensions(data,pending,view=>view==='front'?2:1);
 assert.equal(result.rebuilt,2);assert.equal(result.removed,0);
 const [front,iso,unsupported,review]=result.dimensions;
 assert.deepEqual(front,{view:'front',kind:'horizontal',a:[-30,0],b:[30,0],at:[-30,4],overall:'fronthorizontal',automatic:true});
 assert.equal(iso.review,undefined);
 assert.equal(dimensionValue(iso),60);
 assert.deepEqual(iso.modelA,[-30,0,0]);assert.deepEqual(iso.modelB,[30,0,0]);
 assert.equal(unsupported,pending[2]);assert.equal(review,pending[3]);
});
