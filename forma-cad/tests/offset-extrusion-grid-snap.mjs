import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cadGrid} from '../src/cad-grid.js';
import {basisFor} from '../src/frames.js';
import {createOffsetGridSnap,offsetGridSignature} from '../src/offset-extrusion-grid-snap.js';

const rectangle=(x=15.63,y=5.63,extra={})=>({plane:'XY',offset:0,outer:[[-x,-y],[x,-y],[x,y],[-x,y]],holes:[],...extra});
const project=point=>({x:point.x*20,y:point.y*20,z:0}),near=(a,b)=>assert(Math.abs(a-b)<5e-5,`${a} != ${b}`);
const grids=[];
function gridFor(region,divisions=20){const grid=cadGrid(10,divisions,false),b=basisFor(region);grid.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.u,b.n.clone().negate(),b.v));grid.position.copy(b.n.clone().multiplyScalar(region.offset-.03));grids.push(grid);return grid;}
const region=rectangle(),grid=gridFor(region),snap=createOffsetGridSnap([region],[{object:grid,step:10}]);
let result=snap.pick(4.30,{project});near(result.distance,4.37);assert.equal(result.points.length,4);assert(result.points.every(point=>Math.abs(point[0])===20&&Math.abs(point[1])===10));
assert.equal(snap.pick(3,{project}),null,'outside pixel tolerance');
assert.equal(createOffsetGridSnap([rectangle(15.63,7.13)],[grid]).pick(4.3,{project}),null,'one matching grid line is not an intersection');
assert.equal(createOffsetGridSnap([region],[gridFor(region,2)]).pick(4.3,{project}),null,'finite grid spans are respected');
const signature=offsetGridSignature({enabled:true,grids:[grid]});grid.visible=false;assert.notEqual(offsetGridSignature({enabled:true,grids:[grid]}),signature);assert.equal(createOffsetGridSnap([region],[grid]).pick(4.3,{project}),null);grid.visible=true;
grid.position.set(3,3,-.03);result=createOffsetGridSnap([region],[grid]).pick(-2.60,{project});near(result.distance,-2.63);assert(result.points.some(p=>Math.abs(p[0]-13)<1e-8&&Math.abs(p[1]-3)<1e-8));grid.position.set(0,0,-.03);
for(const plane of ['XY','XZ','YZ','CUSTOM']){
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.31,.42,.27)),frame=Object.fromEntries(['u','v','n'].map((key,i)=>[key,new THREE.Vector3(...[[1,0,0],[0,1,0],[0,0,1]][i]).applyQuaternion(rotation).toArray()])),r=rectangle(15.63,5.63,{plane,offset:7,...(plane==='CUSTOM'?{frame}:{})}),b=basisFor(r),grid=gridFor(r);
 result=createOffsetGridSnap([r],[{object:grid,step:10}]).pick(4.3,{project:p=>({x:p.dot(b.u)*20,y:p.dot(b.v)*20,z:0})});near(result.distance,4.37);assert.equal(result.points.length,4);for(const p of result.points)near(new THREE.Vector3(...p).dot(b.n),7);
}
const angle=Math.PI/4,c=Math.cos(angle),s=Math.sin(angle),rotated=rectangle(9,9,{frame:{u:[c,s,0],v:[-s,c,0],n:[0,0,1]}}),expected=20/Math.sqrt(2)-9;
result=createOffsetGridSnap([rotated],[grid]).pick(expected-.03,{project});near(result.distance,expected);assert.equal(result.points.length,4);
const circle={...region,outer:Array.from({length:64},(_,i)=>[20*Math.cos(i*Math.PI/32),20*Math.sin(i*Math.PI/32)])};assert.equal(createOffsetGridSnap([circle],[grid]).pick(0,{project}),null,'circle tessellation is not a CAD corner');
assert.equal(snap.pick(-5.63,{project}),null,'collapsed offset is not accepted');
assert.equal(createOffsetGridSnap([region],[gridFor(rectangle(15.63,5.63,{plane:'XZ'}))]).pick(4.3,{project}),null,'perpendicular reference grids do not create targets');
for(const grid of grids)grid.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
console.log('PASS OS vertex intersection snapping: exact non-step offsets, signed offset, shifted/finite/hidden grids, rotated frames, topology validation, no false line/circle snaps');
