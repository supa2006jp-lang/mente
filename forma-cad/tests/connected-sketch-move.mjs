import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {commandAvailability} from '../src/command-selection.js';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {pipeWorldPoints} from '../src/pipe-path.js';
import {findRegions} from '../src/regions.js';
import {replayHistory} from '../src/history-replay.js';
import {connectedMoveSources,sketchMoveReferences,translateConnectedSketch,snapSketchMove} from '../src/connected-sketch-move.js';
const dir='outputs/connected-sketch-move/';await fs.mkdir(dir,{recursive:true});
function fixture(placement={plane:'XY'}){
 const b=basisFor(placement),origin=b.n.clone().multiplyScalar(3),base={...defaults,...placement,kind:'sketch',mode:'thin',groupId:'connected',groupNumber:1,groupHidden:false,x:origin.x,y:origin.y,z:origin.z};
 const line=(id,a,c)=>{const center=origin.clone().addScaledVector(b.u,(a[0]+c[0])/2).addScaledVector(b.v,(a[1]+c[1])/2);return {...base,id,name:id,profile:'line',width:Math.hypot(c[0]-a[0],c[1]-a[1]),angle:Math.atan2(c[1]-a[1],c[0]-a[0])*180/Math.PI,x:center.x,y:center.y,z:center.z};};
 const connected=[line('left',[0,0],[0,20]),line('top',[0,20],[15,20]),line('right',[15,20],[15,0]),line('bottom',[15,0],[0,0]),line('branch',[15,20],[25,30]),{...base,id:'curve',name:'曲線',profile:'spline',points:[[25,30],[30,35],[35,30]],tangents:{start:30,end:-30},closed:false}];
 const off=line('off',[0,20],[10,25]);off.x+=b.n.x;off.y+=b.n.y;off.z+=b.n.z;
 return {base,connected,features:[...connected,line('distant',[50,0],[60,0]),{...line('other-group',[0,20],[5,25]),groupId:'other'},off,{...line('hidden',[0,20],[5,30]),groupHidden:true},line('gap',[15.0001,0],[25,0]),line('crossing',[-5,10],[5,10])]};
}
for(const placement of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const {features,connected}=fixture(placement),snapshot=JSON.stringify(features),b=basisFor(placement),delta=b.u.clone().multiplyScalar(10.25).addScaledVector(b.v,-20),sources=connectedMoveSources(features,{featureId:'left'});assert.deepEqual(sources.map(f=>f.id),connected.map(f=>f.id));assert.deepEqual(connectedMoveSources(features,{featureId:'curve'}).map(f=>f.id),connected.map(f=>f.id));
 const moved=translateConnectedSketch(features,sources,delta);validateProject({format:'forma-cad',version:1,features:moved});assert.equal(moved.length,features.length);assert.equal(JSON.stringify(features),snapshot);
 for(let i=0;i<6;i++){assert.equal(moved[i].id,features[i].id);assert.deepEqual(moved[i].tangents,features[i].tangents);const before=pipeWorldPoints(features[i]),after=pipeWorldPoints(moved[i]);for(let j=0;j<before.length;j++)assert(new THREE.Vector3(...after[j]).sub(new THREE.Vector3(...before[j])).distanceTo(delta)<1e-8);}
 assert.deepEqual(moved.slice(6),features.slice(6));assert.throws(()=>translateConnectedSketch(features,sources,b.n),/面内/);
 const project=p=>({x:p.dot(b.u)*10,y:p.dot(b.v)*10,z:0}),raw=b.u.clone().multiplyScalar(19.8).addScaledVector(b.v,30.2).addScaledVector(b.n,3),snap=snapSketchMove({point:raw,basis:b,offset:3,step:10,enabled:true,project});assert.equal(snap.kind,'grid');assert(Math.abs(snap.point.dot(b.u)-20)<1e-8);assert(Math.abs(snap.point.dot(b.v)-30)<1e-8);assert(Math.abs(snap.point.dot(b.n)-3)<1e-8);
 const free=snapSketchMove({point:raw,basis:b,offset:3,step:10,enabled:false,project});assert.equal(free.kind,null);assert(free.point.equals(raw));
 const target={point:raw.clone().addScaledVector(b.u,.1),name:'別の端点'},point=snapSketchMove({point:raw,basis:b,offset:3,step:10,enabled:true,project,targets:[target]});assert.equal(point.kind,'point');assert(point.point.equals(target.point));
 if(placement.plane==='XY'){const region=findRegions(features.slice(0,4))[0],extrusion={...defaults,id:'body',name:'押し出し',kind:'extrusion',profile:'region',region,depth:10,plane:region.plane,frame:region.frame,z:3},history=[...features,extrusion],next=translateConnectedSketch(history,sources,delta),replayed=replayHistory(history,next,0);assert.equal(replayed.at(-1).region.sourceIds.length,region.sourceIds.length);assert(Math.abs(replayed.at(-1).region.outer[0][0]-region.outer[0][0]-delta.x)<1e-7);}
}
assert.deepEqual(sketchMoveReferences([]),[]);assert.equal(commandAvailability('move',{bodies:0,sketchMoveSelection:true}).enabled,true);assert.equal(commandAvailability('move',{bodies:0,sketchMoveSelection:false}).enabled,false);
const {features,base}=fixture(),rect={...base,id:'rect',name:'矩形',profile:'rect',width:10,height:8,x:80,y:20},circle={...base,id:'circle',name:'円',profile:'circle',diameter:10,x:100,y:20};
assert.equal(connectedMoveSources([...features,rect],{featureId:'rect'}).length,1);assert.equal(connectedMoveSources([...features,circle],{featureId:'circle'}).length,1);assert.equal(sketchMoveReferences([circle])[0].name,'円 中心');assert.throws(()=>connectedMoveSources(features,{featureId:'missing'}),/線を選択/);
for(const f of translateConnectedSketch([rect,circle],[rect,circle],new THREE.Vector3(5,10,0)))validateFeature(f);
await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));await fs.writeFile(dir+'custom.forma.json',JSON.stringify({format:'forma-cad',version:1,features:fixture({plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}).features}));await fs.writeFile(dir+'circle.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[circle,rect]}));
const proof={connectedLineBranchSpline:true,curveRoot:true,unrelatedExcluded:true,allWorkplanes:true,immutable:true,idsAndCurvesPreserved:true,planeGridSnap:true,endpointSnap:true,snapDisabled:true,downstreamRegionReplay:true,circleAndRectangle:true};await fs.writeFile(dir+'geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
