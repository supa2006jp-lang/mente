import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as THREE from 'three';
import {runOperation} from '../src/kernel.js';import {printSupportDefaults,validatePrintSupport} from '../src/print-support.js';import {printSupport3mf} from '../src/print-support-3mf.js';import {inspectCadStl} from '../src/stl-cad-inspection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const doc=JSON.parse(await fs.readFile('.sites-runtime/print-support-walls-fixture.forma.json','utf8')),snapshot=JSON.stringify(doc),base={...printSupportDefaults,type:'printSupport',id:'rib-controls',target:'channel',style:'walls',wallPitch:12,topGap:.3,preview:true},out=runOperation(doc.features,base),ribs=out.supportPreview.ribs;
assert.equal(ribs.length,5);assert(ribs.every(r=>r.axis===0));assert.equal(new Set(ribs.map(r=>r.id)).size,5);const changed=runOperation(doc.features,{...base,wallDirection:'x'});assert(changed.supportPreview.ribs.every(r=>r.axis===1));assert.equal(changed.analysis.printSupport.count,3);assert(inspectCadStl(changed.outputs[0]).report.ok);
const fitted=runOperation(doc.features,{...base,lineWidth:.45,wallLines:2,fitLineWidth:true});assert.equal(fitted.analysis.printSupport.wallThickness,.9);assert.equal(fitted.analysis.printSupport.printSettings.wallLines,2);assert.equal(fitted.analysis.printSupport.printSettings.roofThickness,.6);const thin=runOperation(doc.features,{...base,wallThickness:.4,lineWidth:.6});assert(thin.analysis.printSupport.printSettings.warnings.length>0);
const excluded=ribs[2].id,spec={...base,excludedRibs:[excluded]},removed=runOperation(doc.features,spec);assert.equal(removed.analysis.printSupport.count,4);assert.equal(removed.analysis.printSupport.ribs.excluded,1);assert(removed.supportPreview.ribs.find(r=>r.id===excluded).excluded);assert(removed.supportPackage.complete);assert(inspectCadStl(removed.outputs[0]).report.ok);assert(printSupport3mf(removed.supportPackage).length>0);
// The omitted stripe's entire cell must be outside the automatic-support blocker.
const blockers=removed.supportPackage.blockers.map(m=>new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(m.vertices,3)).setIndex(m.triangles),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
const query=x=>new THREE.Raycaster(new THREE.Vector3(x,15,100),new THREE.Vector3(0,0,-1)).intersectObjects(blockers,false);assert.equal(query(ribs[2].center).length,0);assert(query(ribs[1].center).length>0);blockers.forEach(m=>{m.geometry.dispose();m.material.dispose();});
const withSkins={...spec,wallRoof:true,wallBottomSkin:true};
const skinPreview=runOperation(doc.features,{...base,wallRoof:true,wallBottomSkin:true}).supportPreview;
assert(skinPreview.skins[skinPreview.ribs[2].skinGroup].some(skin=>skin.side==='upper'&&skin.ribs.includes(excluded)));
assert(skinPreview.skins[skinPreview.ribs[2].skinGroup].some(skin=>skin.side==='lower'&&skin.ribs.includes(excluded)));
const trimmed=runOperation(doc.features,withSkins);
assert.deepEqual(trimmed.analysis.printSupport.ribs.issues,[]);
assert(trimmed.supportPreview.exportStatus.ok);
assert.equal(trimmed.supportPreview.roof.parts.filter(p=>p.role==='roof').length,2);
const committed=runOperation(doc.features,{...withSkins,preview:false});
assert(inspectCadStl(committed.outputs[0]).report.ok);
const shape=R.deserializeShape(committed.outputs[0].brep).asShape3D();
try{
 const top=ribs[0].bounds[1][2];
 for(const z of [ribs[0].bounds[0][2]+.1,top-.1]){
  for(const [x,present] of [[ribs[2].center,false],[(ribs[0].center+ribs[1].center)/2,true]]){
   const probe=R.makeBox([x-.1,10,z-.05],[x+.1,11,z+.05]),common=shape.intersect(probe);
   try{assert.equal(R.measureVolume(common)>1e-6,present,'skin at '+x+', '+z);}finally{common.delete();probe.delete();}
  }
 }
}finally{shape.delete();}
assert(printSupport3mf(trimmed.supportPackage).length>0);
const restoredBlocker=runOperation(doc.features,{...withSkins,excludedRibBlockers:[excluded]});
assert(restoredBlocker.supportPreview.exportStatus.ok);
assert(restoredBlocker.supportPreview.ribs.find(rib=>rib.id===excluded).autoBlocked);
assert.ok(restoredBlocker.supportPreview.ribs.find(rib=>rib.id===excluded).unsupportedWidth>base.wallPitch);
assert.ok(restoredBlocker.supportPackage.blockers.some(mesh=>mesh.vertices.every((v,i)=>i%3!==2||v>45)&&
 mesh.vertices.some((v,i)=>i%3===0&&v<ribs[2].center)&&mesh.vertices.some((v,i)=>i%3===0&&v>ribs[2].center)));
assert(printSupport3mf(restoredBlocker.supportPackage).length>0);
assert.throws(()=>validatePrintSupport({...base,excludedRibBlockers:[excluded]}),/禁止するリブ/);
const zone={selection:{bodyId:'channel',point:[20,10,ribs[0].bounds[1][2]+base.topGap],normal:[0,0,-1]},noSupport:[[18,8,20,12]]};
const blockedZone=runOperation(doc.features,{...base,faceOverrides:[zone]});
const allowedZone=runOperation(doc.features,{...base,faceOverrides:[{...zone,allowAutoSupport:[0]}]});
assert(blockedZone.supportPreview.exportStatus.ok&&allowedZone.supportPreview.exportStatus.ok);
assert.equal(blockedZone.supportPackage.blockers.length,allowedZone.supportPackage.blockers.length+1);
assert(printSupport3mf(allowedZone.supportPackage).length>0);
const one=runOperation(doc.features,{...withSkins,excludedRibs:ribs.slice(1).map(r=>r.id)});
assert.equal(one.analysis.printSupport.count,1);assert.equal(one.analysis.printSupport.roof.count,0);assert(one.supportPreview.exportStatus.ok);
const edge=runOperation(doc.features,{...base,wallRoof:true,excludedRibs:[ribs[0].id]});assert(edge.supportPreview.exportStatus.ok);
const all=runOperation(doc.features,{...base,excludedRibs:ribs.map(r=>r.id)});assert.equal(all.outputs.length,0);assert.equal(all.supportPreview.ribs.length,5);assert(all.analysis.printSupport.ribs.issues.some(s=>/すべて/));assert.throws(()=>runOperation(doc.features,{...base,preview:false,excludedRibs:ribs.map(r=>r.id)}),/すべて/);
const stale=runOperation(doc.features,{...base,excludedRibs:['old']});assert.equal(stale.analysis.printSupport.ribs.missing.length,1);assert(!stale.supportPackage.complete);assert.throws(()=>runOperation(doc.features,{...base,preview:false,excludedRibs:['old']}),/古い除外/);
for(const bad of [{lineWidth:0},{wallLines:1.2},{fitLineWidth:'yes'},{fitLineWidth:true,lineWidth:.2,wallLines:1},{wallDirection:'z'},{excludedRibs:[excluded,excluded]},{excludedRibs:[1]}])assert.throws(()=>validatePrintSupport({...base,...bad}));
const {supportPreview,supportPackage,...stored}=removed,feature={kind:'cadop',id:spec.id,name:'連結リブサポート',spec:{...spec,preview:false},...stored},saved=[...doc.features,feature],replay=runOperation(saved,{type:'replay',before:saved,start:doc.features.length,forceFull:true}).features.at(-1);assert.deepEqual(replay.spec.excludedRibs,[excluded]);assert.equal(replay.analysis.printSupport.count,4);assert.equal(JSON.stringify(doc),snapshot);
await fs.writeFile('.sites-runtime/support-slicing/rib-controls-rotated-roof.3mf',printSupport3mf(runOperation(doc.features,{...base,wallDirection:'x',wallRoof:true,fitLineWidth:true,lineWidth:.45,wallLines:2}).supportPackage));
await fs.writeFile('.sites-runtime/rib-controls-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:saved}));await fs.writeFile('.sites-runtime/support-slicing/rib-controls.3mf',printSupport3mf(removed.supportPackage));const proof={pass:true,lineWidthFit:true,directionSwitch:true,excludedRib:true,blockerScope:true,unsupportedRoofRemoved:true,emptySelectionPreview:true,staleReferenceBlocked:true,saveReplay:true,closedStl:true,sourceUnchanged:true};await fs.writeFile('.sites-runtime/rib-controls-native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
