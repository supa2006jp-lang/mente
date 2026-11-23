import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {drawingHoleCandidates,holeAnchor,reconcileHoleTable} from '../src/drawing-hole-references.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingThreadLeader,reconcileDrawingThreadLeaders} from '../src/drawing-thread-annotations.js';
import {drawingDimensionCenterGuides,snapDrawingDimensionPoint} from '../src/drawing-dimension-points.js';
import {drawingThreadDimensionTarget,restoreAdjustedThreadDimensions} from '../src/drawing-thread-dimensions.js';
import {dimensionLabel,drawingDimensionGeometry} from '../src/drawing-dimensions.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from '../src/drawing-dimension-references.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

const box={...defaults,kind:'extrusion',id:'block',name:'プレート',width:44,height:38,depth:12};
const hole={...defaults,kind:'extrusion',id:'hole',name:'穴',profile:'circle',diameter:6,z:12,depth:-9,hole:true,operation:'cut',target:box.id};
const spec={type:'thread',target:box.id,id:'thread',surfacePoint:[3,0,10],pitch:1,profile:'metric60',
 threadVersion:2,fullLength:true,leftHand:true};
const targets=[box.id],base=[box,hole];
const project=(features,ids=targets)=>runOperation(features,{type:'orthographic',targets:ids,views:['top','bottom']});
const op=(features,spec)=>[...features,{kind:'cadop',id:spec.id,name:spec.type,spec,...runOperation(features,spec)}];
const options={paper:'A4',orientation:'landscape',name:'ねじテスト',material:'',date:'',viewSelection:['top'],
 frame:true,positions:{top:[24,30],holeTable:[110,26]},isoMode:'hidden'};

test('modeled thread settings follow the numbered hole and callout through replay and PDF layout',()=>{
 const original=op(base,spec),first=project(original),bore=first.views.top.holeMachining[0];
 assert.equal(bore.depth,9);
 assert.deepEqual(bore.thread,{id:'thread',bodyId:'block',end:'high',diameter:6,pitch:1,length:9,leftHand:true});
 assert.deepEqual(drawingDimensionCenterGuides(first.views.top).map(guide=>guide.point),[bore.center]);
 const center=snapDrawingDimensionPoint(first.views.top,[.2,-.35],1);
 assert.deepEqual(center.point,bore.center);
 assert.equal(center.label,'ねじ穴中心 M6');
 const table={view:'top',origin:[-20,15],holes:drawingHoleCandidates(first.views.top,'top',original,targets).map((row,i)=>({number:i+1,...holeAnchor(row)}))};
 assert.equal(table.holes[0].sourceId,'hole');
 const originalNote={id:'leader-test',...drawingThreadLeader('top',bore,[34,32])};
 const proposed=structuredClone(original);
 proposed[2].spec={...spec,fullLength:false,length:5,pitch:.75,leftHand:false};
 const next=runOperation(proposed,{type:'replay',before:original,start:2}).features;
 const data=project(next),leaders=reconcileDrawingThreadLeaders([originalNote],data.views);
 assert.equal(leaders[0].text,'M6×0.75\nねじ深さ 5 mm · 右ねじ');
 const updated=reconcileHoleTable(table,drawingHoleCandidates(data.views.top,'top',next,targets),data.views.top.viewBox);
 assert.equal(updated.holes[0].number,1);
 assert.equal(updated.holes[0].review,undefined);
 const sheet=drawingSheet(data,1,true,[],'',{...options,holeTable:updated,leaders});
 assert.match(sheet.svg,/M6×0.75 \/ 5 mm \/ 右ねじ/);
 assert.match(sheet.svg,/ねじ深さ 5 mm/);
 const pages=drawingPDFPages(data,1,true,[],'',{...options,holeTable:updated,leaders});
 assert.ok(pages.some(page=>page.svg.includes('M6×0.75 / 5 mm / 右ねじ')));
 assert.ok(pages.some(page=>page.svg.includes('ねじ深さ 5 mm')));
 const plain=project(base);
 const [unlinked]=reconcileDrawingThreadLeaders(leaders,plain.views);
 assert.equal(unlinked.review,true);
 assert.doesNotMatch(drawingSheet(plain,1,true,[],'',{...options,holeTable:updated,leaders:[unlinked]}).svg,/M6×/);
});

test('a translated thread stays attached, and an occluding boss or a reamed bore cannot acquire its settings',()=>{
 const threaded=op(base,{...spec,fullLength:false,length:2});
 const moved=op(threaded,{type:'move',id:'move',target:box.id,x:10,y:-5,z:3,angle:0,axis:'Z'});
 const [bore]=project(moved).views.top.holeMachining;
 assert.deepEqual(bore.center.map(Math.round),[10,5]);
 assert.equal(bore.thread.length,2);
 const cover={...defaults,kind:'extrusion',id:'cover',name:'ボス',profile:'circle',diameter:6,z:14,depth:1};
 assert.ok(!project([...threaded,cover],[...targets,cover.id]).views.top.holeMachining.some(row=>row.thread));
 const reamed=op(threaded,{type:'extrusion',id:'ream',target:box.id,feature:{...hole,id:'ream'}});
 assert.ok(!project(reamed).views.top.holeMachining.some(row=>row.thread));
});

test('a thread dimension uses the nominal size and keeps its arrow on the selected counterbore',()=>{
 const thread={id:'thread',bodyId:'plate',end:'high',diameter:6,pitch:1};
 const hole={center:[8,10],radius:3,counterbore:{radius:5},thread};
 const outline='M 0 0 L 40 0 L 40 28 L 0 28 Z';
 const rim='M 3 10 A 5 5 0 0 1 13 10 A 5 5 0 0 1 3 10';
 const view={viewBox:[0,0,40,28],visible:[outline,rim],holeMachining:[hole]};
 const picked=drawingThreadDimensionTarget(view,{arc:{center:[8,10],radius:5},point:[13,10]});
 const d={...picked,kind:'thread',view:'top',at:[16,20]};
 assert.equal(dimensionLabel(d),'M6');
 assert.equal(d.threadRim,'counterbore');
 const geometry=drawingDimensionGeometry(d,{x:10,y:20,bx:0,by:0,scale:2});
 assert.deepEqual(geometry.arrows.map(arrow=>arrow[0]),[[36,40]]);
 assert.deepEqual(geometry.extensions,[[[36,40],[42,60]]]);
 const data={views:{top:view},bounds:[[0,-28,0],[40,0,8]]};
 const refs=captureDrawingReferences(data,[d]);
 const edited={...data,views:{top:{...view,holeMachining:[{...hole,center:[14,12],thread:{...thread,diameter:8}}]}}};
 const [updated]=reconcileDrawingDimensions(edited,[d],refs);
 assert.equal(dimensionLabel(updated),'M8');
 assert.deepEqual(updated.arcPoint,[19,12]);
 const removed={...edited,views:{top:{...view,holeMachining:[]}}};
 assert.equal(dimensionLabel(reconcileDrawingDimensions(removed,[d],refs)[0]),'要確認');
 assert.equal(dimensionLabel({...d,...drawingThreadDimensionTarget({},{arc:{center:[8,10],radius:2},point:[10,10]}),
  nominalDiameter:undefined,threadRef:undefined,threadRim:undefined}),'M4');
});

test('a pull of minus 0.2 mm on an M10 hole preserves the bolt size for new and saved drawing dimensions',()=>{
 const stock={...box,width:32,height:28,depth:9};
 const bore={...hole,diameter:10,z:9,depth:-6};
 const modeled={...spec,surfacePoint:[5,0,7],pitch:1.5,leftHand:false};
 const original=op([stock,bore],modeled);
 const previous=project(original),prior=previous.views.top.holeMachining[0];
 const selected={kind:'thread',view:'top',at:[20,22],
  ...drawingThreadDimensionTarget(previous.views.top,{arc:{center:prior.center,radius:5},point:[5,0]})};
 const adjusted=op(original,{type:'pull',id:'pull',target:box.id,distance:-.2,allThreadFaces:true});
 const next=project(adjusted),rim=next.views.top.holeMachining[0];
 assert.equal(rim.radius,5.2);
 assert.equal(rim.thread.diameter,10);
 assert.equal(rim.thread.adjustedDiameter,10.4);
 assert.equal(rim.thread.id,prior.thread.id);
 const refs=captureDrawingReferences(previous,[selected]);
 const [updated]=reconcileDrawingDimensions(next,[selected],refs);
 const label='M10.4（使用ボルトはM10）';
 assert.equal(dimensionLabel(updated),label);
 assert.equal(updated.radius,5.2);
 assert.equal(dimensionLabel(reconcileDrawingDimensions(previous,[updated],refs)[0]),'M10');
 const old={kind:'thread',view:'top',center:[0,0],radius:5.2,arcPoint:[5.2,0],at:[20,24],pinned:true};
 const [restored]=restoreAdjustedThreadDimensions(next.views,[old]);
 assert.equal(dimensionLabel(restored),label);
 assert.deepEqual(restored.arcPoint,old.arcPoint);
 assert.deepEqual(restored.at,old.at);
 assert.equal(restored.pinned,true);
 assert.equal(dimensionLabel(restoreAdjustedThreadDimensions(previous.views,[old])[0]),'M10.4');
 const sheet=drawingSheet(next,1,true,[updated],'',options);
 assert.ok(sheet.svg.includes(label));
});
