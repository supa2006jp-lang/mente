import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {orthographicProjection} from '../src/orthographic.js';
import {drawingFrontFrame} from '../src/drawing-front.js';
import {followDrawingFrontChange,planDrawingFrontChange,remapDrawingViewSettings} from '../src/drawing-front-references.js';
import {drawingHoleCandidates} from '../src/drawing-hole-references.js';
import {drawingDetailDimensions} from '../src/drawing-detail-dimensions.js';
import {dimensionValue} from '../src/drawing-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {readDrawingState} from '../src/drawing-state.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
const state=overrides=>({viewSelection:['top','front','right'],dimensions:[],dimensionPoints:[],sections:[],details:[],leaders:[],markers:[],...overrides});
const detailView={x:0,y:0,bx:0,by:0,width:300,height:300,scale:2};

test('front changes keep a native hole, an exact section and the dimensions of the same physical views',()=>{
 const block=R.makeBox([0,0,0],[60,40,30]),cutter=R.makeCylinder(3,32,[18,14,-1]),body=block.cut(cutter);
 try{
  const bodies=new Map([['body',body]]),ids=['body'];
  const cut={id:'section-a',view:'top',orientation:'vertical',coordinate:24,reverse:false};
  const prior=orthographicProjection(bodies,ids,[cut],['top','front','right']);
  const originalHole=drawingHoleCandidates(prior.views.top,'top',[],ids)[0];
  assert.equal(originalHole.machining.through,true);
  const radius={kind:'radius',view:'top',center:[18,-14],arcPoint:[21,-14],radius:3,at:[24,-8]};
  const detail={id:'detail-a',view:'top',center:[18,-14],radius:7,factor:2.4};
  const [copy]=drawingDetailDimensions({'detail-a':detailView},[detail],[radius]);
  detail.dimensionPlacements={[copy.detailDimensionKey]:{overview:{at:[25,-10]},pdf:{at:[22,-7]}}};
  const before=state({sections:[cut],details:[detail],holeTable:{view:'top',origin:[0,0],holes:[{center:originalHole.center,radius:3,number:7}],lastNumber:7},
   dimensions:[
    {kind:'aligned',view:'front',a:[0,0],b:[60,0],at:[30,4],displayValue:60.01,precision:2,note:'参考',lineColor:'#123456',pinned:true,pdfPlacement:{at:[30,6],alongOffset:2}},
    {kind:'horizontal',view:'top',a:[0,-40],b:[60,-40],at:[30,-43],overall:'tophorizontal'},
    radius,
   ],leaders:[{id:'leader-a',view:'front',anchor:[22,0],at:[30,9],text:'糸面取り'}],
   markers:[{id:'marker-a',kind:'center',view:'top',center:[18,-14],radius:3}],
   dimensionPoints:[{id:'dimension-point-a',view:'top',point:[8,-4]}]});
  const frame=drawingFrontFrame([1,0,0]),plan=planDrawingFrontChange(undefined,frame,before);
  assert.deepEqual(plan.viewSelection,['top','front','right','left']);
  assert.deepEqual(plan.sections,[{...cut,orientation:'horizontal'}]);
  const current=orthographicProjection(bodies,ids,plan.sections,plan.viewSelection,frame);
  assert.deepEqual(current.sectionErrors,{});
  const after=followDrawingFrontChange(before,plan,current,view=>drawingHoleCandidates(current.views[view],view,[],ids,frame));
  assert.deepEqual(after.dimensions[0],{...before.dimensions[0],view:'left'});
  assert.equal(after.dimensions[1].kind,'vertical');
  assert.equal(after.dimensions[1].overall,'topvertical');
  assert.equal(dimensionValue(after.dimensions[1]),60);
  assert.deepEqual(after.dimensions[2].center,[14,18]);
  assert.deepEqual(after.dimensions[2].arcPoint,[14,21]);
  assert.deepEqual(after.leaders,[{...before.leaders[0],view:'left'}]);
  assert.deepEqual(after.dimensionPoints,[{...before.dimensionPoints[0],point:[4,8]}]);
  assert.deepEqual(after.markers,[{...before.markers[0],center:[14,18]}]);
  assert.deepEqual(after.holeTable.holes,[{number:7,center:[14,18],radius:3}]);
  const [rotatedCopy]=drawingDetailDimensions({'detail-a':detailView},after.details,after.dimensions);
  assert.deepEqual(rotatedCopy.at,[10,25]);
  const [pdfCopy]=drawingDetailDimensions({'detail-a':detailView},after.details,after.dimensions,true);
  assert.deepEqual(pdfCopy.at,[7,22]);
  assert.equal(after.details[0].factor,2.4);
  assert.deepEqual(remapDrawingViewSettings({right:1,front:2,top:3,'detail-a':4},plan.moves),{front:1,left:2,top:3,'detail-a':4});
 }finally{body.delete();cutter.delete();block.delete();}
});

test('an oblique new front keeps compatible measurements and retains ambiguous references for repair',()=>{
 const corner={kind:'horizontal',view:'top',a:[0,0],b:[8,3],at:[4,-4]};
 const edge={...corner,b:[8,0]};
 const cut={id:'section-a',view:'front',orientation:'vertical',coordinate:2,reverse:false};
 const samePlane={...cut,id:'section-b',orientation:'horizontal',coordinate:-3};
 const detail={id:'detail-a',view:'front',center:[4,-5],radius:2,factor:3};
 const leader={id:'leader-a',view:'front',text:'角はバリ取り',anchor:[2,0],at:[4,-10]};
 const before=state({sections:[cut,samePlane],details:[detail],leaders:[leader],
  dimensions:[edge,corner,{kind:'aligned',view:'front',a:[0,0],b:[8,0],at:[4,2]}],
  markers:[{id:'marker-a',view:'front',kind:'line',a:[0,0],b:[8,0]}],
  dimensionPoints:[{id:'dimension-point-a',view:'front',point:[2,0]}],
  holeTable:{view:'front',origin:[0,0],holes:[{number:9,center:[2,-2],radius:1}],lastNumber:9}});
 const frame=drawingFrontFrame([1,-1,0]),plan=planDrawingFrontChange(undefined,frame,before);
 assert.equal(plan.sections[0].review,true);
 assert.equal(plan.sections[1].review,undefined);
 const view={viewBox:[0,-20,20,20],visible:['M0 -20 L20 -20 L20 0 L0 0 Z'],hidden:[]};
 const data={bounds:[[0,0,0],[20,20,20]],views:{front:view,top:view,right:view,'section-b':view}};
 const after=followDrawingFrontChange(before,plan,data,()=>[]);
 assert.equal(after.dimensions[0].kind,'aligned');
 near(dimensionValue(after.dimensions[0]),8);
 assert.deepEqual(after.dimensions[1],{...corner,review:true,unplaced:true});
 assert.equal(after.dimensions[2].unplaced,true);
 assert.deepEqual(after.leaders,[{...leader,review:true}]);
 assert.deepEqual(after.details,[{...detail,review:true}]);
 assert.equal(after.markers[0].review,true);
 assert.equal(after.dimensionPoints[0].review,true);
 assert.equal(after.holeTable.originReview,true);
 assert.deepEqual(after.holeTable.holes,[{...before.holeTable.holes[0],review:true}]);
 const {dimensions,dimensionPoints,...annotations}=after;
 const options={...annotations,name:'',material:'',date:'',frame:false,orientation:'landscape',paper:'A4',positions:{},frontFrame:frame};
 const doc={version:1,signature:'source',targets:['body'],targetMode:'visible',scale:1,hidden:true,comment:'',
  options,dimensions,dimensionPoints};
 assert.deepEqual(readDrawingState(doc),doc);
 const sheet=drawingSheet(data,1,false,dimensions,'',options);
 assert.equal(Object.hasOwn(sheet.layout,'detail-a'),false);
 assert.doesNotMatch(sheet.svg,/data-dimension="[12]"|data-leader|data-marker|data-section="section-a"/);
 assert.match(sheet.svg,/data-hole-row="H9"/);
});

test('an isometric measurement follows exact model vertices or is kept unplaced',()=>{
 const dimension={kind:'aligned',view:'iso',modelA:[0,0,0],modelB:[8,0,0],a:[0,0],b:[5.6,3.3],at:[3,6],overall:'iso-x'};
 const before=state({dimensions:[dimension]}),plan=planDrawingFrontChange(undefined,drawingFrontFrame([1,0,0]),before);
 const vertices=[{point:[0,0],model:[0,0,0]},{point:[-5.6,-3.3],model:[0,-8,0]}];
 const [next]=followDrawingFrontChange(before,plan,{views:{iso:{dimensionVertices:vertices}}},()=>[]).dimensions;
 assert.deepEqual(next.modelB,[0,-8,0]);
 assert.equal(next.overall,'iso-y');
 near(dimensionValue(next),8);
 const [missing]=followDrawingFrontChange(before,plan,{views:{iso:{dimensionVertices:vertices.slice(0,1)}}},()=>[]).dimensions;
 assert.deepEqual(missing,{...dimension,review:true,unplaced:true});
});
