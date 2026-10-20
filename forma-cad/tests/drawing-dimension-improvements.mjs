import assert from 'node:assert/strict';
import {autoDrawingDimensions} from '../src/drawing-auto-dimensions.js';
import {circlePatternDimensions} from '../src/drawing-feature-dimensions.js';
import {arrangeDrawingDimensions,dimensionPlacement} from '../src/drawing-dimension-layout.js';
import {dimensionValue,dimensionLabel,dimensionSVG} from '../src/drawing-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {readDrawingState} from '../src/drawing-state.js';
const rect=(x,y,w,h)=>`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`,circle=(x,y,r)=>`M ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y} Z`;
const data={bounds:[[0,0,0],[120,70,30]],bodyCount:1,views:{front:{visible:['M 0 -30 L 20 -30 L 20 -18 L 40 -18 L 40 -30 L 120 -30 L 120 0 L 0 0 Z'],hidden:[]},top:{visible:[rect(0,-70,120,70),rect(85,-55,20,12),...Array.from({length:4},(_,i)=>circle(20+i*18,-30,2.5))],hidden:[]},right:{visible:[rect(0,-30,70,30)],hidden:[]},iso:{visible:[],hidden:[],viewBox:[0,0,70,45]}}};
const sheet=drawingSheet(data,1,true,[],'',{frame:true}),auto=autoDrawingDimensions(data,1,[],sheet),dims=auto.dimensions;
assert(!dims.some(d=>d.feature==='straight'||d.feature==='location'),'step and groove features must not be added automatically');
const noHoles=structuredClone(data);noHoles.views.top.visible=noHoles.views.top.visible.slice(0,2);assert.equal(autoDrawingDimensions(noHoles,1,[],drawingSheet(noHoles,1)).dimensions.length,6,'notches and slots alone receive only the three-view overall dimensions');
const count=dims.find(d=>d.count===4);assert(count);assert.equal(dimensionLabel(count),'4×Ø5');assert.deepEqual(count.centers,[[20,-30],[38,-30],[56,-30],[74,-30]]);
const pitch=dims.find(d=>d.repeat);assert.equal(dimensionValue(pitch),54);assert.equal(dimensionLabel(pitch),'3×18 = 54');assert.equal(pitch.repeat.pitch,18);
assert.equal(autoDrawingDimensions(data,1,dims,sheet).dimensions.length,0,'repeat click must not add group members again');
assert.equal(autoDrawingDimensions(data,1,[],sheet).layoutWarnings,0,'the fixture should fit without collisions');
const geometry=dims.map(d=>dimensionPlacement(d,sheet)),overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(let i=0;i<geometry.length;i++){for(let j=0;j<i;j++)assert(!overlap(geometry[i].box,geometry[j].box),'annotation labels overlap');for(const v of Object.values(sheet.layout))assert(!overlap(geometry[i].box,{x:v.x,y:v.y-7,width:v.width,height:v.height+7}),'label covers a view');}
const collision=dims.slice(0,4).map(d=>({...d,at:[30,0]})),arranged=arrangeDrawingDimensions(collision,sheet);assert(arranged.dimensions.some((d,i)=>d.at.some((n,j)=>n!==collision[i].at[j])));assert.equal(arranged.unresolved.length,0);
const locked={...dims[0],at:[12,14]},preserved=JSON.stringify(locked);arrangeDrawingDimensions(dims.slice(1),sheet,[locked]);assert.equal(JSON.stringify(locked),preserved,'manual annotations are never mutated during auto input');
const v=sheet.layout.top;assert.equal(circlePatternDimensions([[10,-10],[30,-10],[51,-10]],'top',v),null,'unequal spacing must not claim equal pitch');assert.equal(circlePatternDimensions([[10,-10],[30,-10],[10,-30]],'top',v),null,'incomplete grid must not claim a rectangular pitch');
const grid=circlePatternDimensions([[10,-10],[30,-10],[50,-10],[10,-30],[30,-30],[50,-30]],'top',v);assert.equal(grid.dimensions.length,2);assert(grid.dimensions.some(d=>d.repeat?.count===2&&d.repeat.pitch===20));
const partial={view:'top',kind:'diameter',center:[20,-30],radius:2.5,at:[20,-10]},upgraded=autoDrawingDimensions(data,1,[partial],sheet);assert.equal(upgraded.dimensions.find(d=>d.kind==='diameter').count,3,'a manual callout is preserved instead of being replaced by a group');
const state={version:1,signature:'test',dimensions:dims,scale:1,hidden:true,comment:'',targets:['part'],targetMode:'visible',options:{paper:'auto',orientation:'landscape',frame:true,name:'',material:'',date:'',positions:{}}};readDrawingState(state);
for(const corrupt of [s=>s.dimensions.find(d=>d.count).count=5,s=>s.dimensions.find(d=>d.count).centers[1]=[20,-30],s=>s.dimensions.find(d=>d.repeat).repeat.pitch=17,s=>s.dimensions.find(d=>d.repeat).repeat.count='<img>']){const bad=structuredClone(state);corrupt(bad);assert.throws(()=>readDrawingState(bad));}
assert.match(dimensionSVG(count,v,1,0),/4×Ø5/);assert.match(dimensionSVG(pitch,v,1,0),/3×18 = 54/);
console.log(JSON.stringify({dimensions:dims.length,group:dimensionLabel(count),pitch:dimensionLabel(pitch),layoutWarnings:auto.layoutWarnings}));
console.log('PASS step and groove auto dimensions disabled, grouped circles, verified row/grid pitch, collision avoidance, manual preservation, deduplication, saved-state validation and SVG labels');
