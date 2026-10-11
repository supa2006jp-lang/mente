import assert from 'node:assert/strict';
import * as THREE from 'three';
import {splineCurve,splineEndpoint,splineSamples} from '../src/spline-curve.js';
import {snapSplineTangent} from '../src/spline-tangent-snap.js';
import {defaults,validateFeature} from '../src/geometry.js';
const feature={...defaults,id:'curve',kind:'sketch',profile:'spline',points:[[0,0],[20,8],[35,0]],tangents:{start:25,end:-30}},original=splineSamples(feature);
assert.deepEqual(splineSamples({...feature,tangentLengths:{start:splineEndpoint(feature,'start').handleLength}}),original,'explicit automatic length preserves old curves');
for(const points of [feature.points,feature.points.slice(0,2)])for(const handleLength of [.1,4,20]){
 const f={...feature,points,tangentLengths:{start:handleLength,end:handleLength*2}},curve=splineCurve(f),e=1e-7,n=points.length-1;
 for(const end of ['start','end']){const d=end==='start'?curve.getPoint(e).sub(curve.getPoint(0)):curve.getPoint(1).sub(curve.getPoint(1-e)),expected=f.tangents[end]*Math.PI/180;
  assert.ok(d.clone().normalize().distanceTo(new THREE.Vector3(Math.cos(expected),Math.sin(expected),0))<.001,'length edits preserve direction');
  assert.ok(Math.abs(d.length()/e/n-f.tangentLengths[end]*3)<.001,'derivative matches physical handle length');
 }
 for(let i=0;i<points.length;i++)assert.ok(curve.getPoint(i/n).distanceTo(new THREE.Vector3(...points[i],0))<1e-9);
}
assert.notDeepEqual(splineSamples({...feature,tangentLengths:{start:2}}),splineSamples({...feature,tangentLengths:{start:20}}),'length changes the curve');
for(const value of [null,[],{start:0},{end:-1},{start:10001},{end:'3'},{other:3}])assert.throws(()=>validateFeature({...feature,tangentLengths:value}),/ハンドル/);
for(const value of [{},{start:.01},{end:10000}])validateFeature({...feature,tangentLengths:value});
const project=p=>({x:400+p[0]*5,y:400-p[1]*5,z:0}),base={feature,features:[],endpoint:[0,0],handle:[12,5],project};
for(const [angle,expected] of [[2,0],[43,45],[92,90],[-88,-90],[179,-180],[-137,-135]])assert.equal(snapSplineTangent({...base,angle}).angle,expected);
assert.equal(snapSplineTangent({...base,angle:12}).label,'');assert.equal(snapSplineTangent({...base,angle:2,disabled:true}).angle,2);
const line={...defaults,id:'line',kind:'sketch',profile:'line',mode:'thin',width:30,x:8,y:2,angle:23};
assert.equal(snapSplineTangent({...base,features:[line],angle:21}).angle,23);
assert.ok(snapSplineTangent({...base,features:[line],angle:-155}).guide,'either direction along the same line');
for(const changed of [{z:5},{y:100},{groupHidden:true},{id:'curve'},{plane:'XZ'}])assert.equal(snapSplineTangent({...base,features:[{...line,...changed}],angle:21}).label,'','ignore unrelated geometry');
const frame={u:[0,1,0],v:[0,0,1],n:[1,0,0]},side={...feature,plane:'CUSTOM',frame,x:10},poly={...line,plane:'YZ',x:10,profile:'polyline',points:[[0,0],[15*Math.cos(.4),15*Math.sin(.4)]]};
const result=snapSplineTangent({...base,feature:side,features:[poly],angle:-68});assert.ok(Math.abs(result.angle-(-90+.4*180/Math.PI))<1e-8,'reference directions transform into the custom sketch basis');
console.log('PASS handle length derivatives/fit points/compatibility, validation, axis/line snapping, exclusions and custom plane');
