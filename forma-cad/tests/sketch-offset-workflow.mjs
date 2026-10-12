import assert from 'node:assert/strict';
import {defaults,validateFeature,makeGeometry,volume} from '../src/geometry.js';
import {offsetSketchAllAround,offsetSketch} from '../src/sketch-offset.js';
import {offsetExtrusionRegions,replaceOffsetSources,offsetDragReferences,offsetDragValue} from '../src/sketch-offset-workflow.js';
import {findRegions,regionContains,sketchPoints} from '../src/regions.js';
import {sketchSegments} from '../src/sketch-selection.js';

const line={...defaults,id:'line',name:'線',kind:'sketch',profile:'line',width:20,groupId:'g',groupNumber:1},rect={...line,id:'rect',profile:'rect',height:10},circle={...line,id:'circle',profile:'circle',diameter:20};
for(const f of [line,rect,circle]){const output=offsetSketchAllAround([f],2),regions=offsetExtrusionRegions(output,[f],true);assert.equal(regions.length,1);if(f.profile!=='line')assert.equal(regions[0].holes.length,1,'only the band gets selected');for(const r of regions){const g=makeGeometry({...defaults,profile:'region',region:r,depth:3});assert.ok(volume(g)>0);g.dispose();}}
assert.equal(offsetExtrusionRegions(offsetSketch(line,2),[line],false).length,0,'an open one-sided line cannot be extruded');assert.equal(offsetExtrusionRegions(offsetSketch(rect,2),[rect],false).length,1);
const disconnected=[line,{...line,id:'other',y:15}];assert.equal(offsetExtrusionRegions(offsetSketchAllAround(disconnected,2),disconnected,true).length,2);
const original=structuredClone(rect),selection=new Map([['rect',new Set([0])]]),remaining=replaceOffsetSources([rect,circle],{selection});assert.equal(remaining.length,2);assert.equal(sketchSegments(remaining[0]).length,3);assert.equal(remaining[1],circle);assert.deepEqual(rect,original);remaining.forEach(validateFeature);
assert.deepEqual(replaceOffsetSources([rect,circle],{sourceId:'rect'}),[circle]);
const features=[{...rect,id:'a',width:20,height:20,x:0,y:0},{...rect,id:'b',width:20,height:20,x:10,y:0}];
const region=findRegions(features).find(r=>regionContains(r,[-5,0]));assert.ok(region);const rest=replaceOffsetSources(features,{region});rest.forEach(validateFeature);assert.ok(rest.length>0);assert.ok(rest.some(f=>sketchPoints(f).some(p=>Math.abs(p[0]-20)<1e-7)),'unselected far edge survives region replacement');assert.ok(!rest.some(f=>sketchSegments(f).some(s=>s.a.x===-10&&s.b.x===-10)),'selected exterior is removed');
// A divider longer than the selected region retains the portions outside it.
const divider={...line,id:'divider',width:40,angle:90},box={...rect,width:20,height:20};const half=findRegions([box,divider]).find(r=>regionContains(r,[5,0]));assert.ok(half);const fragments=replaceOffsetSources([box,divider],{region:half}).filter(f=>f.id==='divider'||f.name==='線'&&f.profile==='polyline');assert.ok(fragments.length>=2);for(const f of fragments)for(const s of sketchSegments(f))assert.ok(Math.min(Math.abs(s.a.y),Math.abs(s.b.y))>=10-1e-6);
for(const plane of ['XY','XZ','YZ']){const f={...line,plane},refs=offsetDragReferences([f],true);assert.equal(refs.length,2);assert.ok(Math.abs(refs[0].direction.dot(refs[1].direction)+1)<1e-8);assert.ok(Math.abs(refs[0].direction.dot(sketchSegments(f)[0].b.clone().sub(sketchSegments(f)[0].a)))<1e-8);}
assert.equal(offsetDragValue(-5,{allAround:true}),.001);assert.equal(offsetDragValue(-5),-5);assert.equal(offsetDragValue(9.9,{snap:true,step:10,pixelsPerMm:10}),10);assert.equal(offsetDragValue(7,{snap:true,step:10,pixelsPerMm:10}),7);assert.equal(offsetDragValue(0),.001);
console.log('PASS auto-select offset bands/disconnected regions, open-line handling, partial/whole/region source replacement, preserved outside fragments, plane drag references and snap limits');
