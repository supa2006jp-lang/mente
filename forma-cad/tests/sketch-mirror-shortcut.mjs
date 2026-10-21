import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateProject,validateFeature} from '../src/geometry.js';
import {basisFor,worldPoint} from '../src/frames.js';
import {pipeWorldPoints} from '../src/pipe-path.js';
import {mirrorSketch} from '../src/sketch-mirror.js';
import {mirrorAxisReference} from '../src/mirror-workflow.js';
import {mirrorConnectedSketch,sketchMirrorReference} from '../src/connected-sketch-mirror.js';

const dir='outputs/sketch-mirror-shortcut/';await fs.mkdir(dir,{recursive:true});
function fixture(placement={plane:'XY'}){
 const b=basisFor(placement),p=b.n.clone().multiplyScalar(3),base={...defaults,...placement,kind:'sketch',mode:'thin',groupId:'connected',groupNumber:1,groupHidden:false,x:p.x,y:p.y,z:p.z};
 const line=(id,a,c)=>{const center=p.clone().addScaledVector(b.u,(a[0]+c[0])/2).addScaledVector(b.v,(a[1]+c[1])/2);return {...base,id,name:id,profile:'line',width:Math.hypot(c[0]-a[0],c[1]-a[1]),angle:Math.atan2(c[1]-a[1],c[0]-a[0])*180/Math.PI,x:center.x,y:center.y,z:center.z};};
 const connected=[line('axis',[0,0],[0,20]),line('top',[0,20],[15,20]),line('right',[15,20],[15,0]),line('bottom',[15,0],[0,0]),line('branch',[15,20],[25,30]),{...base,id:'spline',name:'曲線',profile:'spline',points:[[25,30],[30,35],[35,30]],tangents:{start:30,end:-30},closed:false}];
 const off=line('off-plane',[0,20],[10,25]);off.x+=b.n.x;off.y+=b.n.y;off.z+=b.n.z;
 const features=[...connected,line('distant',[50,0],[60,0]),{...line('other-group',[0,20],[5,25]),groupId:'other'},off,{...line('hidden',[0,20],[5,30]),groupHidden:true},line('gap',[15.0001,0],[25,0]),line('crossing',[-5,10],[5,10])];
 return {features,connected,base,line};
}
for(const placement of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const {features,connected}=fixture(placement),before=JSON.stringify(features),result=mirrorConnectedSketch(features,{featureId:'axis',index:0});assert.deepEqual(result.sources.map(f=>f.id),connected.map(f=>f.id));assert.equal(result.features.length,features.length+6);assert.equal(new Set(result.features.map(f=>f.id)).size,result.features.length);assert.equal(JSON.stringify(features),before);
 const n=new THREE.Vector3(...result.spec.mirrorNormal),origin=new THREE.Vector3(...result.spec.mirrorOrigin);
 for(const [i,copy]of result.copies.entries()){validateFeature(copy);assert.equal(copy.profile,connected[i].profile);const original=pipeWorldPoints(connected[i]),mirrored=pipeWorldPoints(copy);assert.equal(original.length,mirrored.length);for(let j=0;j<original.length;j++){const expected=new THREE.Vector3(...original[j]);expected.addScaledVector(n,2*origin.clone().sub(expected).dot(n));assert(expected.distanceTo(new THREE.Vector3(...mirrored[j]))<1e-7);}}
 assert.equal(sketchMirrorReference(features,{featureId:'spline',index:0}),null);assert.throws(()=>mirrorConnectedSketch(features,{featureId:'missing',index:0}),/クリック/);
}
// A selected rectangle/polyline edge is the axis, not the feature's first edge.
const rect={...defaults,kind:'sketch',id:'rect',name:'長方形',profile:'rect',groupId:'rect-group',groupNumber:1,width:12,height:8,x:24,y:8},mirrored=mirrorConnectedSketch([rect],{featureId:'rect',index:3});assert.equal(mirrored.copies[0].x,12);assert.equal(mirrored.copies[0].y,8);
// Copy controls follow the reflected object; the separate axis stays halfway.
for(const placement of [{plane:'XY'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const basis=basisFor(placement),normal=basis.u,frame={basis,offset:3},origin=basis.u.clone().multiplyScalar(18).addScaledVector(basis.n,3),source=worldPoint({...placement,offset:3},[24,8]),copyPoint=d=>source.clone().addScaledVector(normal,2*(origin.dot(normal)+d-source.dot(normal))),spec={mirrorNormal:normal.toArray(),mirrorOrigin:origin.toArray(),offset:2};
 const ref=mirrorAxisReference(frame,spec,copyPoint(2),{followCopy:true});assert(ref.handleBase.clone().addScaledVector(ref.handleDirection,2).distanceTo(copyPoint(2))<1e-10);assert(ref.handleBase.clone().addScaledVector(ref.handleDirection,5).distanceTo(copyPoint(5))<1e-10);assert(Math.abs(ref.handleDirection.length()-2)<1e-12);assert(Math.abs(ref.direction.length()-1)<1e-12);
}
const data=fixture();validateProject({format:'forma-cad',version:1,features:data.features});await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:data.features}));await fs.writeFile(dir+'rectangle.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[rect]}));
const proof={connectedBranchAndSpline:true,clickedEdgeIsAxis:true,allWorkplanes:true,originalAndCurvesPreserved:true,realGapsCrossingsGroupsPlanesHiddenExcluded:true,copyHandleMovesOneToOne:true,axisPositionCorrect:true};await fs.writeFile(dir+'geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
