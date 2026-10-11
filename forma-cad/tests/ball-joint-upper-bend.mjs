import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {cleanBinaryStl} from '../src/clean-stl.js';
import {binaryStlReport} from './stl-topology.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointNeckLayout,ballJointBasePoint} from '../src/ball-joint-neck-layout.js';
import {createBallClampSectionModel} from '../src/ball-joint-section.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40};
const info=runOperation([source],{type:'ballJointInfo',target:'c'}).analysis;
const p={...ballJointDefaults(info),type:'ballJoint',id:'joint',target:'c',pose:'assembled',neckBend:true,neckExtension:15,neckBendDirection:45};
assert.equal(p.neckBendStyle,'upper');
const legacy={...p};delete legacy.neckBendStyle;
assert.equal(ballJointSettings(info,legacy).neckBendStyle,'lower','old files retain their geometry');
const s=ballJointSettings(info,p),q=ballJointNeckLayout(s);
const vol=x=>Math.abs(R.measureVolume(x)),shape=o=>R.deserializeShape(o.brep).asShape3D();
const result=runOperation([source],p),placement=new THREE.Matrix4().fromArray(result.analysis.placements[0]);
const point=x=>new THREE.Vector3(...x).applyMatrix4(placement),direction=x=>new THREE.Vector3(...x).transformDirection(placement);
const base=point(q.base),elbow=point(q.bend),center=point([0,0,s.splitPosition]);
const lower=elbow.clone().sub(base).normalize(),upper=center.clone().sub(elbow).normalize();
assert.ok(lower.distanceTo(new THREE.Vector3(0,0,1))<1e-9,'root is vertical to horizontal base');
assert.ok(Math.abs(upper.angleTo(lower)*180/Math.PI-45)<1e-9,'upper rod bends 45 degrees');
assert.ok(Math.abs(Math.atan2(upper.y,upper.x)*180/Math.PI-45)<1e-9,'azimuth is independently 45 degrees');
assert.ok(direction(q.direction).distanceTo(lower)<1e-9,'base normal follows root');
assert.ok(result.analysis.overlap.every(v=>v<1e-5));
assert.equal(result.analysis.ballDiameter,15.6);assert.equal(result.analysis.neckDiameter,6.24);
assert.equal(result.analysis.neckBallTiltAngle,45);assert.equal(result.analysis.neckBaseTiltAngle,0);
for(const o of result.outputs){const b=shape(o),check=new (R.getOC().BRepCheck_Analyzer)(b.wrapped,true,false),solids=b.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(b));}finally{check.delete();solids.forEach(x=>x.delete());b.delete();}}
for(const o of result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);const mesh=new THREE.Mesh(g);mesh.updateMatrixWorld(true);const report=binaryStlReport(cleanBinaryStl(new STLExporter().parse(mesh,{binary:true})));for(const key of ['boundary','nonmanifold','degenerate','orientation'])assert.equal(report[key],0,'closed STL '+key);g.dispose();mesh.material.dispose();}
const ball=shape(result.outputs[0]);
for(const center of [base.clone().lerp(elbow,.35),elbow.clone().lerp(point([0,0,s.splitPosition-s.r]),.5)]){const probe=R.makeSphere(.1).translate(center.toArray()),hit=ball.intersect(probe);assert.ok(Math.abs(vol(hit)-vol(probe))<1e-7,'actual rod fills both intended centre lines');probe.delete();hit.delete();}
const faces=ball.faces;assert.ok(faces.some(f=>{if(f.geomType!=='PLANE')return false;const n=f.normalAt();try{return n.z<-.999999;}finally{n.delete();}}),'base has horizontal free end');faces.forEach(x=>x.delete());ball.delete();
const old=runOperation([source],{...p,neckBendStyle:'lower',neckBaseTilt:true});
for(let i=0;i<3;i++){const a=shape(result.outputs[i]),b=shape(old.outputs[i]).rotate(-45,q.base,q.rotationAxis),ab=a.cut(b),ba=b.cut(a);assert.ok(vol(ab)+vol(ba)<1e-4,'whole assembly rotates together and keeps mating dimensions');[a,b,ab,ba].forEach(x=>x.delete());}
const printed=runOperation([source],{...p,pose:'print'});
for(const o of printed.outputs)assert.ok(Math.abs(o.vertices.reduce((m,v,i)=>i%3===2?Math.min(m,v):m,Infinity))<1e-5);
const printPlacement=new THREE.Matrix4().fromArray(printed.analysis.placements[0]);assert.ok(new THREE.Vector3(...q.direction).transformDirection(printPlacement).distanceTo(new THREE.Vector3(0,0,1))<1e-9);
const section=createBallClampSectionModel(result);assert.ok(section.slice().parts.every(p=>p.segments.length));section.dispose();
const feature={kind:'cadop',id:'joint',name:'根元は垂直・球側45°',spec:p,...result},history=[source,feature];validateProject({format:'forma-cad',version:1,features:history});
const replay=runOperation(history,{type:'replay',before:history,start:1});assert.equal(replay.features[1].analysis.neckBendStyle,'upper');assert.equal(replay.features[1].analysis.neckBendDirection,45);
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/ball-joint-upper-project.json',JSON.stringify({format:'forma-cad',version:1,features:history}));
console.log('PASS vertical solid root, actual upper rod at 45 degrees, independent azimuth, unchanged mating parts, horizontal base, print placement, section, replay and legacy compatibility');
