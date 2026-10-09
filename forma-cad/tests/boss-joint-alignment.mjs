import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import * as THREE from 'three';
import {applyBossSection,createBossSectionModel} from '../src/boss-joint-section.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {makeBossJoint} from '../src/boss-joint.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'base',kind:'extrusion',name:'本体',width:60,height:40,depth:30},spec={type:'bossJoint',mode:'split',id:'joint',target:'base',plane:'XY',offset:15,pose:'assembled',count:2,diameter:3,length:4,clearance:.25,bossWall:1.6,bossHeight:8,spacing:0,offsetU:0,offsetV:0,shellEnabled:true,shellThickness:2,alignmentEnabled:true,alignmentHeight:1.5,alignmentWidth:.8,alignmentClearance:.25};
function valid(result){for(const o of result.outputs){const s=R.deserializeShape(o.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);}finally{s.delete();check.delete();solids.forEach(s=>s.delete());}}assert.ok(result.analysis.overlap<1e-5);}
const aligned=runOperation([base],spec);valid(aligned);assert.ok(aligned.analysis.alignment.addedVolume>100);assert.ok(aligned.analysis.alignment.removedVolume>aligned.analysis.alignment.addedVolume);assert.equal(aligned.analysis.alignment.grooveDepth,1.75);
const history=[base,{kind:'cadop',id:spec.id,name:'位置決め付きボス接合',spec,...aligned}];validateProject({format:'forma-cad',version:1,features:history});
const bodies=kernelBodies(history);try{
 function material(id,x,z){const probe=R.makeCylinder(.05,.1,[x,0,z]),hit=bodies.get(id).intersect(probe);try{return R.measureVolume(hit)>1e-6;}finally{probe.delete();hit.delete();}}
 assert.ok(material('base',28.9,15.8),'lip extends above the mating plane');assert.ok(!material('joint-pin',28.9,15.8),'groove receives the lip');
 for(const x of [29.5,28.4]){assert.ok(!material('base',x,15.8));assert.ok(!material('joint-pin',x,15.8),'clearance exists on both sides of the lip');}
 assert.ok(material('joint-pin',29.85,15.8),'outside wall stays closed');assert.ok(material('joint-pin',28.9,16.85),'groove retains its floor');assert.ok(!material('base',28.9,16.6),'lip has specified height');
 assert.ok(!material('base',0,5)&&!material('joint-pin',0,20),'interiors remain hollow');
 for(const shape of bodies.values()){const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][0]+30)<1e-5&&Math.abs(box.bounds[1][0]-30)<1e-5,'outer dimensions remain unchanged');}finally{box.delete();}}
}finally{for(const shape of bodies.values())shape.delete();}
for(const change of [{shellEnabled:false},{profile:'circle'},{plane:'XZ',offset:0},{plane:'YZ',offset:0},{reinforcement:'round',reinforcementSize:1},{reinforcement:'ribs',reinforcementSize:1},{count:4},{alignmentHeight:2,alignmentWidth:.6,alignmentClearance:.2}]){const {profile,...settings}=change,result=runOperation([{...base,...(profile?{profile,diameter:50}:{})}],{...spec,...settings});valid(result);assert.ok(result.analysis.alignment.enabled);}
assert.throws(()=>runOperation([base],{...spec,shellThickness:1.6}),/壁厚/);
for(const change of [{alignmentHeight:0},{alignmentWidth:.1},{alignmentClearance:0},{alignmentHeight:NaN},{alignmentEnabled:'yes'},{alignmentHeight:15}])assert.throws(()=>runOperation([base],{...spec,...change}),/位置決め|壁厚/);
const split=runOperation([base],{type:'split',id:'upper',target:'base',plane:'XY',offset:15}),pairHistory=[base,{kind:'cadop',id:'upper',outputs:split.outputs,remove:split.remove}],pair=runOperation(pairHistory,{...spec,mode:'pair',pinTarget:'upper'});valid(pair);assert.deepEqual(pair.outputs.map(o=>o.id),['base','upper']);
const raw=kernelBodies(pairHistory);try{const a=raw.get('base').clone().rotate(28,[0,0,0],[1,1,0]).translate([7,-3,9]),b=raw.get('upper').clone().rotate(28,[0,0,0],[1,1,0]).translate([7,-3,9]),volumes=[R.measureVolume(a),R.measureVolume(b)];try{const result=makeBossJoint(a,b,{...spec,mode:'pair',pinTarget:'upper',pose:'print'});try{assert.ok(result.analysis.alignment.enabled);assert.deepEqual([R.measureVolume(a),R.measureVolume(b)],volumes);for(const shape of result.parts){const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);}finally{box.delete();}}}finally{result.parts.forEach(s=>s.delete());}}finally{a.delete();b.delete();}}finally{raw.forEach(s=>s.delete());}
const printed=runOperation([base],{...spec,pose:'print'}),model=createBossSectionModel(aligned),printModel=createBossSectionModel(printed);
try{
 const envelope=p=>{const points=p.fill;return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];};
 for(let i=0;i<spec.count;i++){const section=model.slice(i),other=printModel.slice(i);assert.equal(section.index,i);for(const [j,part]of section.parts.entries()){assert.ok(part.segments.length&&part.fill.length);envelope(part).forEach((v,k)=>assert.ok(Math.abs(v-envelope(other.parts[j])[k])<2e-4,'section is independent of printing pose'));}
  const x=aligned.analysis.positions[i].uv[section.horizontal],z=-2,crossings=[];for(let j=0;j<section.parts[0].segments.length;j+=6){const s=section.parts[0].segments,x1=s[j],z1=s[j+2],x2=s[j+3],z2=s[j+5];if(Math.abs(z2-z1)>1e-8&&z>=Math.min(z1,z2)&&z<=Math.max(z1,z2))crossings.push(x1+(x2-x1)*(z-z1)/(z2-z1));}for(const edge of [x-1.75,x+1.75])assert.ok(crossings.some(v=>Math.abs(v-edge)<2e-4),'section shows actual receiver hole');
 }
}finally{model.dispose();printModel.dispose();}
const preview=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.set(70,-80,60);camera.lookAt(0,0,15);camera.updateMatrixWorld();for(const output of aligned.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial()));preview.add(mesh);}const clipModel=createBossSectionModel(aligned);try{const counts=preview.children.map(m=>m.geometry.index.count);applyBossSection(preview,clipModel.slice(0),camera);assert.equal(preview.getObjectByName('boss-section-caps').children.length,2);const normal=preview.children[0].material.clippingPlanes[0].normal.clone();assert.ok(preview.children[0].children[0].material.clippingPlanes.length);applyBossSection(preview,clipModel.slice(0),camera,true);assert.ok(normal.dot(preview.children[0].material.clippingPlanes[0].normal)<-.999);applyBossSection(preview,null,camera);assert.equal(preview.getObjectByName('boss-section-caps'),undefined);assert.ok(preview.children.every(m=>m.material.clippingPlanes.length===0));assert.deepEqual(preview.children.map(m=>m.geometry.index.count),counts,'sectioning never modifies the exported geometry');}finally{clipModel.dispose();preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
// A 0.6 mm nozzle needs printable walls beside the lid groove, not merely
// a valid solid. Probe the actual saved BREP across both walls and the floor.
const safeSpec={...spec,alignmentPrintSafe:true},safe=runOperation([base],safeSpec);valid(safe);
assert.equal(safe.analysis.alignment.width,1.2);assert.equal(safe.analysis.alignment.outerLand,1.2);assert.equal(safe.analysis.alignment.innerLand,1.2);assert.equal(safe.analysis.alignment.floor,1.2);assert.ok(safe.analysis.alignment.collarAddedVolume>0);
const safeHistory=[base,{kind:'cadop',id:spec.id,name:'0.6 mmノズル用位置決め',spec:safeSpec,...safe}];validateProject({format:'forma-cad',version:1,features:safeHistory});
const safeBodies=kernelBodies(safeHistory);try{
 function full(id,x,z,r=.04){const probe=R.makeCylinder(r,.08,[x,0,z]),hit=safeBodies.get(id).intersect(probe);try{return Math.abs(R.measureVolume(hit)-R.measureVolume(probe))<1e-7;}finally{probe.delete();hit.delete();}}
 for(const x of [29.95,29.4,28.85])assert.ok(full('joint-pin',x,15.7),'outer lid wall has a full 1.2 mm width');
 for(const x of [27.05,26.5,25.95])assert.ok(full('joint-pin',x,15.7),'inner lid wall has a full 1.2 mm width');
 for(const x of [28.5,27.9,27.4]){assert.ok(full('base',x,15.7),'lip is at least two nozzle widths');assert.ok(!full('joint-pin',x,15.7),'groove remains open');assert.ok(full('joint-pin',x,17.95),'groove floor is 1.2 mm thick');}
 assert.ok(full('joint-pin',26.5,18.3)&&!full('joint-pin',26.5,19.8),'inside collar transitions back to the original wall');
 assert.ok(!full('base',0,5)&&!full('joint-pin',0,20),'local reinforcement keeps the central cavity hollow');
 for(const shape of safeBodies.values()){assert.ok(solidMeshComplete(shape),'printable rim and groove keep a complete export mesh');const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][0]+30)<1e-5&&Math.abs(box.bounds[1][0]-30)<1e-5);}finally{box.delete();}}
}finally{safeBodies.forEach(s=>s.delete());}
for(const change of [{profile:'circle'},{plane:'XZ',offset:0},{pose:'print'},{shellEnabled:false},{shellThickness:1.6}]){const {profile,...settings}=change,result=runOperation([{...base,...(profile?{profile,diameter:50}:{})}],{...safeSpec,...settings});valid(result);assert.ok(result.analysis.alignment.printSafe);}
assert.throws(()=>runOperation([base],{...safeSpec,offset:27.5}),/位置決め.*深さ/);
assert.throws(()=>runOperation([base],{...safeSpec,alignmentPrintSafe:'yes'}),/印刷補強/);
assert.equal(aligned.analysis.alignment.outerLand,.4,'legacy saved dimensions remain unchanged');
console.log('PASS 0.6 mm alignment reinforcement, printable groove walls/floor, 45-degree local collar, clearance, original outer size/cavity and legacy compatibility');
console.log('PASS alignment lip/groove with side and bottom clearance, hollow/solid/circular/XZ/YZ/pair/rotated/print, reinforcement, walls, invalid inputs and actual section pose/holes');
