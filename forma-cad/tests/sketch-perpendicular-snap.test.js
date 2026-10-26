import test from 'node:test';import assert from 'node:assert/strict';
import {snapSketchLinePerpendicular as snap} from '../src/sketch-perpendicular-snap.js';
const project=([x,y])=>({x:x*10,y:y*10}),segment={a:[10,20],b:[70,50],kind:'sketch'},foot=[28,29],normal=[-1/Math.sqrt(5),2/Math.sqrt(5)],near=(a,b)=>assert(Math.abs(a-b)<1e-10);
test('oblique segments attract to the exact perpendicular foot from either side, without mutating inputs',()=>{
 for(const sign of [-1,1]){const origin=foot.map((x,i)=>x+normal[i]*20*sign),point=[foot[0]+.12,foot[1]-.08],before=structuredClone([point,origin,segment]),r=snap(point,origin,[segment],{project});assert(r.snapped);assert.equal(r.kind,'sketch');r.point.forEach((v,i)=>near(v,foot[i]));near((r.point[0]-origin[0])*60+(r.point[1]-origin[1])*30,0);assert.deepEqual([point,origin,segment],before);}
});
test('finite segments only: no extension, degenerate edge, origin on edge, far cursor or oblique approach',()=>{
 const edge={a:[10,20],b:[70,20]},options={project};
 for(const [p,o]of [[[8,20],[8,40]],[[40,20],[40,20]],[[40,22],[40,40]],[[42,20],[40,40]],[[40,40],[40,30]]])assert(!snap(p,o,[edge],options).snapped);
 assert(!snap([40,20],[40,40],[{a:[40,20],b:[40,20]}],options).snapped);
 assert(!snap([NaN,20],[40,40],[edge],options).snapped);
 assert(!snap([40,20],[40,40],[edge],{project:()=>({x:NaN,y:0})}).snapped);
});
test('screen tolerance, closest candidate, temporary disabling and numeric angle priority',()=>{
 const edge={a:[10,20],b:[70,20],kind:'solid'},origin=[38.7,40],point=[38.8,20.1];
 assert(snap(point,origin,[edge],{project}).snapped);
 assert(!snap(point,origin,[edge],{project:([x,y])=>({x:x*100,y:y*100})}).snapped);
 assert(!snap(point,origin,[edge],{project,disabled:true}).snapped);
 for(const angle of [0,90,37])assert(!snap(point,origin,[edge],{project,angle}).snapped);
 assert(snap(point,origin,[edge],{project,angle:270}).snapped);
 assert.equal(snap(point,origin,[{...edge,a:[10,19.6],b:[70,19.6],kind:'far'},edge],{project}).kind,'solid');
});
