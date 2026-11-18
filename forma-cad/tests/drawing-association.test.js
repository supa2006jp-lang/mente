import assert from 'node:assert/strict';
import {test} from 'node:test';
import {holeReferenceInventory,reconcileHoleTable} from '../src/drawing-hole-references.js';
import {drawingHoleMarkers,resolveDrawingHoleTable,drawingHoleTableSVG,drawingHoleTableSize} from '../src/drawing-hole-table.js';
import {followSectionEdit} from '../src/drawing-section-references.js';
import {alignThirdAngleViews,isThirdAngleLayout} from '../src/drawing-view-preferences.js';

const hole=(x,sourceId,radius=2.5)=>({center:[x,0],radius,...(sourceId?{sourceId}:{})});
const table=(holes,all=holes)=>({view:'top',origin:[0,0],holes,references:holeReferenceInventory(all)});
const box=[0,0,60,24];
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
