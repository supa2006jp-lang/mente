import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,makeGeometry,volume} from '../src/geometry.js';
import {cadPosition} from '../src/cad-coordinates.js';
import {extrudeRegion} from '../src/regions.js';
import {sectionSegments} from '../src/section-view.js';
import {cadFaceSelections,cadFaceGeometry} from '../src/face-selection.js';
import {firstMoveContact} from '../src/move-until-contact.js';
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
test('raw extrusion preserves native cap/profile coordinates before placement and GPU rounding',()=>{
 const f={...defaults,id:'a',kind:'extrusion',width:17.32050807568877,height:20,depth:12.77,x:1234.123456,z:.123456789},g=makeGeometry(f);
 try{const exact=new THREE.Box3().setFromBufferAttribute(cadPosition(g)),displayed=new THREE.Box3().setFromBufferAttribute(g.attributes.position);near(exact.min.x,f.x-f.width/2);near(exact.max.z,f.z+f.depth);assert(Math.abs(displayed.min.x-exact.min.x)>1e-6);assert(g.attributes.position.array instanceof Float32Array);assert(cadPosition(g).array instanceof Float64Array);}finally{g.dispose();}
});
test('sub-Float32 features far from origin retain distinct corners and volume',()=>{
 const r={id:'r',plane:'XY',offset:0,outer:[[9999.9999,0],[10000.0001,0],[10000.0001,10],[9999.9999,10]],holes:[],area:.002,sourceIds:[]},g=extrudeRegion(r,10);
 try{const exact=new THREE.Box3().setFromBufferAttribute(cadPosition(g));near(exact.max.x-exact.min.x,.0002,1e-10);near(volume(g),.02,1e-7);const segments=sectionSegments(g,new THREE.Plane(new THREE.Vector3(0,0,1),-5));assert(segments.some((v,i)=>i%3===0&&Math.abs(v-9999.9999)<1e-10));assert(segments.some((v,i)=>i%3===0&&Math.abs(v-10000.0001)<1e-10));}finally{g.dispose();}
});
test('selected face references retain exact centroids; contact uses original coordinates',()=>{
 const f={...defaults,id:'a',kind:'extrusion',width:17.32050807568877,height:20,depth:12.77},g=makeGeometry(f),other=makeGeometry({...f,width:30,height:30,x:40.123456});
 try{const groups={parts:[{start:0,count:3},{start:3,count:3}]},selected=cadFaceGeometry(g,groups),refs=cadFaceSelections(g,groups);assert(cadPosition(selected).array instanceof Float64Array);near(refs[0].point[2],0);near(refs[1].point[2],f.depth);selected.dispose();const result=firstMoveContact(new THREE.Mesh(g),[new THREE.Mesh(other)],0,1);near(result.distance,40.123456-15-f.width/2);}finally{g.dispose();other.dispose();}
});
test('negative, oblique, circular and symmetric preview topology remains closed',()=>{
 for(const plane of ['XY','XZ','YZ'])for(const profile of ['rect','circle']){const f={...defaults,id:'a',kind:'extrusion',profile,plane,depth:-12.123456789,angle:17.3,symmetric:true},g=makeGeometry(f);try{near(volume(g),Math.abs(f.depth)*2*(profile==='rect'?f.width*f.height:64*Math.sin(Math.PI/64)*(f.diameter/2)**2),1e-6);}finally{g.dispose();}}
});
