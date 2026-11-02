import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {extrusionBoundaryCandidates,snapExtrusionBoundary,extrusionBoundaryDistance} from '../src/extrusion-boundary-snap.js';
import {basisFor,worldPoint} from '../src/frames.js';import {defaults} from '../src/geometry.js';import {retainCadCoordinates} from '../src/cad-coordinates.js';
const feature={...defaults,kind:'extrusion',width:10,height:10,depth:2},edgeMesh=(segments,precise=false)=>{const mesh=new THREE.Mesh(new THREE.BufferGeometry()),g=new THREE.BufferGeometry().setFromPoints(segments.flat().map(p=>new THREE.Vector3(...p)));if(precise)retainCadCoordinates(g,segments.flat(2));mesh.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial()));return mesh;};
const values=c=>c.map(x=>Number(x.value.toFixed(8)));
test('adjacent edges and edges spanning the footprint supply precise stopping distances, while distant and hidden bodies do not',()=>{
 const exact=12.345678901234,near=edgeMesh([[[-10,5,exact],[10,5,exact]]],true),far=edgeMesh([[[100,100,8],[120,100,8]]]),hidden=edgeMesh([[[-2,0,4],[2,0,4]]]);hidden.visible=false;
 const result=extrusionBoundaryCandidates([feature],new Map([['neighbor',near],['far',far],['hidden',hidden]]));assert.equal(result.length,1);assert.ok(Math.abs(result[0].value-exact)<1e-12);assert.equal(result[0].bodyId,'neighbor');assert.ok(Math.abs(result[0].point.x)<=5.00001);
 assert.equal(snapExtrusionBoundary(exact+.1,result,{snapEnabled:true,pixelsPerMm:20}),result[0]);assert.equal(snapExtrusionBoundary(exact+.5,result,{snapEnabled:true,pixelsPerMm:20}),null);assert.equal(snapExtrusionBoundary(exact,result,{snapEnabled:false}),null);
});
test('clipped sloping boundaries use intersections with the profile instead of remote endpoint depths',()=>{
 const mesh=edgeMesh([[[-10,0,10],[10,0,30]]]),result=extrusionBoundaryCandidates([feature],new Map([['sloped',mesh]]));assert.deepEqual(values(result),[15,25]);
});
test('XYZ and arbitrary planes, negative travel and symmetry use signed world positions',()=>{
 for(const plane of ['XY','XZ','YZ','CUSTOM']){const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.3,.8,-.4)),frame=plane==='CUSTOM'?Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3().setComponent(i,1).transformDirection(rotation).toArray()])):undefined,f={...feature,plane,frame,x:5,y:4,z:7},b=basisFor(f),offset=new THREE.Vector3(f.x,f.y,f.z).dot(b.n),center=new THREE.Vector3(f.x,f.y,f.z),c=[center.dot(b.u),center.dot(b.v)],segments=[-13.25,18.75].map(d=>[[-2,0],[2,0]].map(p=>worldPoint({plane,frame,offset:offset+d},[c[0]+p[0],c[1]+p[1]]).toArray())),mesh=edgeMesh(segments,true),result=extrusionBoundaryCandidates([f],new Map([['body',mesh]]));assert.deepEqual(values(result),[-13.25,18.75]);assert.deepEqual(values(extrusionBoundaryCandidates([{...f,symmetric:true}],new Map([['body',mesh]]))),[13.25,18.75]);}
});
test('holes, base-plane edges and invalid distances cannot become false stops',()=>{
 const region={plane:'XY',offset:0,outer:[[-5,-5],[5,-5],[5,5],[-5,5]],holes:[[[-2,-2],[2,-2],[2,2],[-2,2]]]},mesh=edgeMesh([[[0,0,4],[1,0,4]],[[-4,-4,0],[4,-4,0]],[[-4,-4,10001],[4,-4,10001]],[[-4,4,7],[4,4,7]]]);assert.deepEqual(values(extrusionBoundaryCandidates([{...feature,profile:'region',region}],new Map([['body',mesh]]))),[7]);
});
test('mesh transforms and all selected profiles participate without changing the source meshes',()=>{
 const mesh=edgeMesh([[[0,-2,0],[0,2,0]]]);mesh.position.set(20,0,8);mesh.updateWorldMatrix(true,true);const before=mesh.toJSON(),result=extrusionBoundaryCandidates([feature,{...feature,x:20}],new Map([['moved',mesh]]));assert.deepEqual(values(result),[8]);assert.deepEqual(mesh.toJSON(),before);
});

test('grid and solid boundary snapping choose the closest level and OFF keeps free movement',()=>{const boundary={value:18.25,bodyId:'neighbor'},options={snapEnabled:true,step:10,pixelsPerMm:3};assert.equal(extrusionBoundaryDistance(18.30,[boundary],options).boundary,boundary);assert.deepEqual(extrusionBoundaryDistance(20,[boundary],options),{value:20,snapped:true,boundary:null});assert.deepEqual(extrusionBoundaryDistance(18.3,[boundary],{...options,snapEnabled:false}),{value:18.3,snapped:false,boundary:null});});

test('pending native-coordinate restoration cannot introduce a Float32 stopping gap',()=>{const mesh=edgeMesh([[[-2,0,18.123456789],[2,0,18.123456789]]],true);mesh.geometry.userData.cadCoordinatePrecision=false;assert.deepEqual(extrusionBoundaryCandidates([feature],new Map([['pending',mesh]])),[]);mesh.geometry.userData.cadCoordinatePrecision=true;const result=extrusionBoundaryCandidates([feature],new Map([['pending',mesh]]));assert.ok(Math.abs(result[0].value-18.123456789)<1e-12);});
