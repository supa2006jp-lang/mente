import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {runOperation} from '../src/kernel.js';
import {rebuild} from '../src/geometry.js';
import {basisFor,planarFace,worldPoint} from '../src/frames.js';
import {createFilletGridReference} from '../src/fillet-grid-reference.js';
import {createSketchBoundarySnap} from '../src/sketch-boundary-snap.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),snap=createSketchBoundarySnap(),grid=createFilletGridReference();
const box=R.makeBox([0,0,0],[60,40,30]),seed={kind:'cadop',id:'seed',outputs:[{id:'body',...box.mesh({tolerance:.08,angularTolerance:.15}),brep:box.serialize()}],remove:[]};
const round={type:'fillet',id:'round',target:'body',radius:3},initial=[seed,{kind:'cadop',id:'round',spec:round,...runOperation([seed],round)}];
function faceAt(geometry,normal,offset){const p=geometry.attributes.position,ix=geometry.index,at=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i);for(let i=0;i<(ix?.count??p.count);i+=3){const [a,b,c]=[at(i),at(i+1),at(i+2)],n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.dot(normal)>.999999&&[a,b,c].every(p=>Math.abs(p.dot(normal)-offset)<1e-4))return {...planarFace(geometry,i/3),bodyId:'body'};}throw Error('face missing');}
function check(features,normal,offset){
 const body=rebuild(features).get('body'),mesh=new THREE.Mesh(body.geometry),face=faceAt(body.geometry,normal,offset),reference=grid.reference(face,features),basis=basisFor(face),project=p=>({x:p.dot(basis.u)*10,y:p.dot(basis.v)*10});
 assert.ok(reference.filletGridReference);
 const ring=reference.outer,a=worldPoint(reference,ring[0]),b=worldPoint(reference,ring[1]),tangent=b.clone().sub(a).normalize(),point=a.clone().lerp(b,.37),side=basis.n.clone().cross(tangent),hit=point.clone().addScaledVector(side,.3);
 assert.equal(snap.snap([mesh],basis,offset,hit,project),null,'the former grid outline is outside the filleted flat face');
 const result=snap.reference(reference,basis,offset,hit,project);assert.ok(result);near(result.distanceTo(point),0);
 const locked=snap.reference(reference,basis,offset,hit,project,{origin:point.clone().addScaledVector(side,10),direction:side.clone().negate()});near(locked.distanceTo(point),0);
 const farther=point.clone().addScaledVector(side,.9);assert.equal(snap.reference(reference,basis,offset,farther,project),null,'reference snapping retains the pixel tolerance');
 assert.equal(snap.reference(reference,basis,offset+1,hit,project),null,'no reference from another plane');
 assert.equal(snap.reference(face,basis,offset,hit,project),null,'unmarked actual faces do not create a reference outline');
 const epsilon=snap.reference(reference,basis,offset+1e-6,hit,project);near(epsilon.dot(basis.n),offset+1e-6,1e-8);
 // The physical, inset flat-face edge remains independently available.
 const outer=face.outer,flat=worldPoint(face,outer[0]).lerp(worldPoint(face,outer[1]),.37),actual=snap.snap([mesh],basis,offset,flat,project);assert.ok(actual);near(actual.distanceTo(flat),0,.002);
 body.geometry.dispose();
}
check(initial,new THREE.Vector3(0,0,1),30);check(initial,new THREE.Vector3(0,-1,0),0);check(initial,new THREE.Vector3(1,0,0),60);
const move={type:'move',id:'move',target:'body',rotation:[35,0,0],pivot:[0,0,0],x:11,y:7,z:2},moved=[...initial,{kind:'cadop',id:'move',spec:move,...runOperation(initial,move)}],angle=35*Math.PI/180,n=new THREE.Vector3(0,-Math.sin(angle),Math.cos(angle));check(moved,n,30+n.dot(new THREE.Vector3(11,7,2)));
const holeBody=rebuild(initial).get('body');const hole={...grid.reference(faceAt(holeBody.geometry,new THREE.Vector3(0,0,1),30),initial),holes:[[[20,10],[30,10],[30,20],[20,20]]]},basis=basisFor(hole),p=worldPoint(hole,[20.3,16]);const h=snap.reference(hole,basis,30,p,q=>({x:q.x*10,y:q.y*10}));near(h.x,20);near(h.y,16);
holeBody.geometry.dispose();box.delete();grid.clear();snap.clear();
console.log('PASS filleted reference boundaries on top and side faces, physical flat-face boundaries, locked angles, transformed bodies, holes, pixel tolerance and plane isolation');
