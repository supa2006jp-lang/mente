import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateFeature,validateProject,makeGeometry,volume} from '../src/geometry.js';
import {offsetSketch,offsetSketchAllAround} from '../src/sketch-offset.js';
import {offsetSketchSelection,sketchSegments} from '../src/sketch-selection.js';
import {sketchPoints,planeCoordinates,ringArea,findRegions,regionContains} from '../src/regions.js';
import {basisFor,worldPoint} from '../src/frames.js';

const base={...defaults,id:'source',name:'線',kind:'sketch',profile:'line',width:20,groupId:'g',groupNumber:1,groupHidden:false},distance=2;
const near=(a,b,e=.00003)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function checkDistance(input,output,d){
 const segments=input.flatMap(f=>{const p=sketchPoints(f);return p.slice(1).map((b,i)=>[p[i],b]);});
 for(const f of output){validateFeature(f);assert.equal(f.closed,true);assert.notEqual(f.id,input[0].id);for(const p of f.points)near(Math.min(...segments.map(([a,b])=>segmentDistance(p,a,b))),d,.0051);}
}
const original=structuredClone(base),capsule=offsetSketch(base,distance,{allAround:true});assert.equal(capsule.length,1);checkDistance([base],capsule,distance);assert.deepEqual(base,original);
const bounds=new THREE.Box2().setFromPoints(capsule[0].points.map(p=>new THREE.Vector2(...p)));near(bounds.min.x,-12,.006);near(bounds.max.x,12,.006);near(bounds.min.y,-2,.006);near(bounds.max.y,2,.006);near(ringArea(capsule[0].points),80+Math.PI*4,.06);
assert.equal(capsule[0].groupId,'g');assert.equal(offsetSketch(base,2)[0].closed,false,'legacy remains a single open offset');near(offsetSketch(base,-2)[0].points[0][1],-2);
const bent={...base,profile:'polyline',points:[[0,0],[20,0],[20,10]],closed:false},bentCopy=offsetSketch(bent,2,{allAround:true});checkDistance([bent],bentCopy,2);
const rect={...base,id:'rect',profile:'rect',height:10},rings=offsetSketch(rect,2,{allAround:true});assert.equal(rings.length,2);checkDistance([rect],rings,2);assert.deepEqual(rings.map(f=>Math.round(ringArea(f.points))).sort((a,b)=>a-b),[-96,333]);
const circle={...base,profile:'circle',diameter:12};assert.deepEqual(offsetSketch(circle,2,{allAround:true}).map(f=>f.diameter),[16,8]);assert.deepEqual(offsetSketch(circle,7,{allAround:true}).map(f=>f.diameter),[26]);
const single=offsetSketchSelection([rect],new Map([['rect',new Set([0])]]),2,{allAround:true});assert.equal(single.length,1);checkDistance([{...base,profile:'polyline',points:[[-10,-5],[10,-5]]}],single,2);
const lines=[{...base,id:'a',profile:'polyline',points:[[0,0],[20,0]],closed:false},{...base,id:'b',profile:'polyline',points:[[20,0],[20,10]],closed:false}];
const connected=offsetSketchSelection(lines,new Map(lines.map(f=>[f.id,new Set([0])])),2,{allAround:true});assert.equal(connected.length,1,'connected selected lines form one outline');checkDistance(lines,connected,2);
const loop=[[[-10,-5],[10,-5]],[[10,-5],[10,5]],[[10,5],[-10,5]],[[-10,5],[-10,-5]]].map((points,i)=>({...base,id:'loop'+i,profile:'polyline',points,closed:false}));
const closed=offsetSketchSelection(loop,new Map(loop.map(f=>[f.id,new Set([0])])),2,{allAround:true});assert.equal(closed.length,2);checkDistance(loop,closed,2);
const apart=offsetSketchAllAround([base,{...base,id:'apart',y:10}],2);assert.equal(apart.length,2,'disjoint paths stay separate');
const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]};
for(const plane of ['XY','XZ','YZ','CUSTOM']){const f={...base,plane,frame:plane==='CUSTOM'?frame:undefined,x:3,y:5,z:7,angle:31},out=offsetSketch(f,2,{allAround:true});checkDistance([f],out,2);for(const copy of out){const b=basisFor(copy),o=planeCoordinates(copy);near(o.offset,planeCoordinates(f).offset);for(const p of sketchPoints(copy))near(worldPoint({...copy,offset:o.offset},p).dot(b.n),o.offset);}}
const reversed={...base,id:'reverse',plane:'CUSTOM',frame:{u:[-1,0,0],v:[0,1,0],n:[0,0,-1]},z:0};assert.equal(offsetSketchAllAround([base,reversed],2).length,1,'same physical plane merges even with a reversed frame');
assert.equal(offsetSketchAllAround([base,{...base,id:'above',z:10}],2).length,2,'parallel planes never merge');
const curve={...base,profile:'spline',points:[[0,0],[10,8],[20,0]],closed:false,tangents:{start:20},tangentLengths:{start:4}},curveCopy=offsetSketch(curve,2,{allAround:true});checkDistance([curve],curveCopy,2);assert.equal(curveCopy[0].tangents,undefined);
const crossing=offsetSketchAllAround([{...base,angle:0},{...base,id:'cross',angle:90}],2);assert.equal(crossing.length,1);checkDistance([{...base,angle:0},{...base,angle:90}],crossing,2);
for(const d of [0,-2,NaN,Infinity,10001])assert.throws(()=>offsetSketch(base,d,{allAround:true}));assert.throws(()=>offsetSketchAllAround([{...base,profile:'point'}],2));
const region=findRegions(capsule).find(r=>regionContains(r,[0,0]));assert.ok(region);const g=makeGeometry({...defaults,kind:'extrusion',profile:'region',region,depth:3});near(volume(g),(80+Math.PI*4)*3,.2);g.dispose();validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:capsule})));
console.log('PASS full-surround offsets: equal distance, round ends/joins, closed inner/outer contours, partial/multiple lines, unions, all planes, circles/splines, legacy mode, extrusion and save');
