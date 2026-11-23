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
import {autoDrawingDimensions,unmeasuredDrawingHoles} from '../src/drawing-auto-dimensions.js';
import {groupDrawingDimensions} from '../src/drawing-dimension-groups.js';
import {readDrawingState} from '../src/drawing-state.js';

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
 const label='Ø10.4（使用ボルトはM10）';
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
 const automatic=autoDrawingDimensions(next,1,[],sheet,{types:['diameter']}).dimensions;
 assert.deepEqual(automatic.map(dimensionLabel),[label]);
 assert.deepEqual(automatic[0].threadRef,updated.threadRef);
 const oldLeader={id:'leader-pull',...drawingThreadLeader('top',prior,[21,20])};
 const [leader]=reconcileDrawingThreadLeaders([oldLeader],next.views);
 assert.equal(leader.text.split('\n')[0],label);
 const holes=drawingHoleCandidates(next.views.top,'top',adjusted,targets).map((row,i)=>({number:i+1,...holeAnchor(row)}));
 const annotated={...options,leaders:[leader],holeTable:{view:'top',origin:[-10,10],holes}};
 const rendered=drawingSheet(next,1,true,automatic,'',annotated);
 const pages=drawingPDFPages(next,1,true,automatic,'',annotated);
 for(const outputs of [[rendered],pages]){
  const table=outputs.find(({holeBox})=>holeBox)?.svg.split('data-hole-table="true"')[1]??'';
  assert.ok(table.includes(label)&&table.includes('ピッチ 1.5 mm'));
  assert.ok(outputs.some(({svg})=>/data-leader="leader-pull"[^]*?Ø10\.4（使用ボルトはM10）[^]*?ねじ深さ/.test(svg)));
 }
 assert.equal(autoDrawingDimensions(next,1,[updated],sheet,{types:['diameter']}).dimensions.length,0);
});

test('automatic dimensions distinguish adjusted bores from same-size plain circles and refresh saved groups',()=>{
 const centers=[[12,14],[32,14],[52,14],[72,14]],radius=5.2;
 const circle=([x,y],r)=>`M ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y}`;
 const bore=(center,diameter,bodyId)=>({center,radius,
  thread:{id:bodyId,bodyId,end:'high',diameter,adjustedDiameter:10.4}});
 const top={viewBox:[0,0,84,28],visible:['M 0 0 L 84 0 L 84 28 L 0 28 Z',
  ...centers.map(center=>circle(center,radius)),circle(centers[0],7)],hidden:[],
  holeMachining:[bore(centers[0],10,'nut-a'),bore(centers[1],9,'nut-b')]};
 const data={views:{top},bounds:[[0,-28,0],[84,0,8]]},settings={types:['diameter']};
 const sheet=drawingSheet(data,1,true,[],'',options);
 const added=autoDrawingDimensions(data,1,[],sheet,settings).dimensions;
 const labels=dimensions=>dimensions.map(dimensionLabel).sort();
 const m10='Ø10.4（使用ボルトはM10）',m9='Ø10.4（使用ボルトはM9）';
 assert.deepEqual(labels(added),['2×Ø10.4','Ø14',m10,m9].sort());
 assert.equal(autoDrawingDimensions(data,1,added,sheet,settings).dimensions.length,0);
 assert.equal(autoDrawingDimensions(data,1,[],sheet,{types:['spacing']}).dimensions.some(d=>d.kind==='thread'),false);
 const old={kind:'diameter',view:'top',automatic:true,center:centers[0],radius,centers,count:4,at:[98,20],fontSize:3.8,pinned:true};
 const result=autoDrawingDimensions(data,1,[old],sheet,settings);
 assert.equal(result.updated,1);
 assert.deepEqual(result.existing,[{...old,center:centers[2],centers:centers.slice(2),count:2}]);
 assert.deepEqual(labels(result.dimensions.filter(d=>d.kind==='thread')),[m10,m9].sort());
 assert.ok(result.dimensions.filter(d=>d.kind==='thread').every(d=>d.fontSize===old.fontSize&&d.automatic));
 const {centers:members,count,...single}=old;
 const refreshed=autoDrawingDimensions(data,1,[single],sheet,settings).existing[0];
 assert.equal(dimensionLabel(refreshed),m10);
 assert.deepEqual(refreshed.at,single.at);
 assert.equal(refreshed.pinned,true);
 const details=[{id:'detail-a',view:'top',center:centers[0],radius:8,factor:2}];
 const detailSheet=drawingSheet(data,1,true,[],'',{...options,details});
 const detail=autoDrawingDimensions(data,1,[],detailSheet,{...settings,views:{top:[]},details}).dimensions;
 assert.deepEqual(labels(detail),['Ø14',m10].sort());
 assert.ok(detail.every(d=>d.view==='detail-a'));
});

test('automatic dimensions prioritize threaded openings across views and list the remaining visible circles',()=>{
 const radii=[5,4,3,2];
 const circle=([x,y],r)=>`M ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y}`;
 const regular=radii.map((radius,i)=>circle([12+i*16,-10],radius));
 const adjustedCenter=[62,-23],normalCenter=[14,-14];
 const view=(width,paths,holeMachining=[])=>({hidden:[],visible:[`M 0 0 L ${width} 0 L ${width} -32 L 0 -32 Z`,...paths],holeMachining});
 const threaded=(center,radius,diameter,adjustedDiameter)=>({center,radius,
  thread:{id:'thread',bodyId:'plate',end:'high',diameter,pitch:.5,adjustedDiameter}});
 const data={bounds:[[0,0,0],[72,32,32]],views:{
  top:view(72,[...regular,circle(adjustedCenter,1.6),circle([21,-23],.3)],[threaded(adjustedCenter,1.6,3,3.2)]),
  front:view(72,regular),
  right:view(32,[circle(normalCenter,1.5)],[threaded(normalCenter,1.5,3)]),
 }};
 const sheet=drawingSheet(data,1,true,[],'',{frame:true,isoMode:'hidden'});
 const settings={types:['diameter']};
 const result=autoDrawingDimensions(data,1,[],sheet,settings);
 assert.equal(result.dimensions.length,8);
 assert(result.dimensions.some(d=>d.kind==='thread'&&dimensionLabel(d)==='Ø3.2（使用ボルトはM3）'));
 assert(result.dimensions.some(d=>d.view==='right'&&dimensionLabel(d)==='M3'));
 assert.deepEqual(result.omitted.map(({dimension:d,reason})=>[d.view,dimensionLabel(d),reason]),
  [['top','Ø4','limit'],['top','Ø0.6','small'],['front','Ø4','limit']]);
 const recovered={...result.omitted[0].dimension,at:[54,-40]};
 const dimensions=[...result.dimensions,recovered];
 assert.deepEqual(unmeasuredDrawingHoles(result.omitted,dimensions),result.omitted.slice(1));
 const again=autoDrawingDimensions(data,1,dimensions,sheet,settings);
 assert.deepEqual(again.dimensions,[]);
 assert.deepEqual(again.omitted,result.omitted.slice(1));
});

test('thread dimensions group only matching machining specifications and keep each reference',()=>{
 const specification={diameter:10,adjustedDiameter:10.4,pitch:1.5,length:5,leftHand:false};
 const variants=[{},{},{},{},{pitch:1.25},{length:4},{leftHand:true},{diameter:9.5},{adjustedDiameter:10.6}];
 const holes=variants.map((variant,i)=>{
  const thread={...specification,...variant,id:'tap-'+i,bodyId:'block',end:'high'};
  return {center:[12+(i%5)*18,-12-Math.floor(i/5)*18],radius:thread.adjustedDiameter/2,depth:8,thread};
 });
 const circle=({center:[x,y],radius:r})=>`M ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y}`;
 const top={viewBox:[0,-42,100,42],visible:['M 0 0 L 100 0 L 100 -42 L 0 -42 Z',...holes.map(circle)],hidden:[],holeMachining:holes};
 const data={bounds:[[0,0,0],[100,42,10]],views:{top}};
 const manual=holes.map(h=>{
  const [x,y]=h.center;
  return {kind:'thread',view:'top',at:[x,y+15],...drawingThreadDimensionTarget(top,{arc:h,point:[x+h.radius,y]})};
 });
 const grouped=groupDrawingDimensions(manual,data.views),[group]=grouped,label='4×Ø10.4（使用ボルトはM10）';
 assert.equal(grouped.length,6);
 assert.equal(dimensionLabel(group),label);
 assert.deepEqual(group.centers,holes.slice(0,4).map(h=>h.center));
 assert.deepEqual(group.threadRefs.map(ref=>ref.id),['tap-0','tap-1','tap-2','tap-3']);
 assert.ok(grouped.slice(1).every(d=>d.count===undefined));
 assert.equal(groupDrawingDimensions([manual[0],manual[0]],data.views).length,2);
 assert.deepEqual(groupDrawingDimensions(grouped,data.views),grouped);

 const sheet=drawingSheet(data,1,true,[],'',options),settings={types:['diameter']};
 const generated=autoDrawingDimensions(data,1,[],sheet,settings);
 assert.deepEqual(generated.dimensions.map(dimensionLabel).sort(),grouped.map(dimensionLabel).sort());
 assert.equal(autoDrawingDimensions(data,1,generated.dimensions,sheet,settings).dimensions.length,0);
 const individual=autoDrawingDimensions(data,1,[],sheet,{...settings,groupRepeated:false}).dimensions;
 assert.equal(individual.length,holes.length);
 assert.ok(individual.every(d=>!d.count));
 const state={version:1,signature:'fixture',targets:['block'],targetMode:'visible',scale:1,hidden:true,comment:'',options,dimensions:grouped};
 assert.deepEqual(readDrawingState(JSON.parse(JSON.stringify(state))).dimensions,grouped);
 assert.throws(()=>readDrawingState({...state,dimensions:[{...group,threadRefs:group.threadRefs.map(()=>group.threadRef)}]}));
 assert.ok(drawingPDFPages(data,1,true,grouped,'',options).some(page=>page.svg.includes(label)));

 const refs=captureDrawingReferences(data,grouped);
 const moved=holes.map(h=>({...h,center:h.center.map(value=>value+1)}));
 const movedData={...data,views:{top:{...top,holeMachining:moved}}};
 const [updated]=reconcileDrawingDimensions(movedData,grouped,refs);
 assert.equal(dimensionLabel(updated),label);
 assert.deepEqual(updated.centers,moved.slice(0,4).map(h=>h.center));
 const changed=[...moved];
 changed[1]={...changed[1],thread:{...changed[1].thread,pitch:1.25}};
 const [review]=reconcileDrawingDimensions({...data,views:{top:{...top,holeMachining:changed}}},[updated],refs);
 assert.equal(dimensionLabel(review),'要確認');
 assert.equal(dimensionLabel(reconcileDrawingDimensions(movedData,[review],refs)[0]),label);
});
