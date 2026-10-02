import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {trimInterior} from '../src/trim-interior.js';import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const frustum=(r0,r1,z0,z1)=>R.draw([0,z0]).lineTo([r0,z0]).lineTo([r1,z1]).lineTo([0,z1]).close().sketchOnPlane('XZ').revolve([0,0,1]);
const vol=s=>R.measureVolume(s);
for(const slope of [0,.2]){
 const cavity=frustum(20,20+40*slope,5,45),outer=frustum(23,23+45*slope,0,45),cup=outer.cut(cavity);
 const handle=R.makeCylinder(3,25,[12,0,15],[1,0,0]).fuse(R.makeCylinder(3,25,[12,0,35],[1,0,0])).fuse(R.makeCylinder(3,20,[37,0,15],[0,0,1]));
 for(const joined of [false,true])for(const tilted of [false,true]){
  const transform=s=>tilted?s.clone().rotate(37,[0,0,0],[0,1,0]).translate([11,-7,8]):s.clone();
  const ref=transform(cup),target=transform(joined?cup.fuse(handle):handle),expected=transform(joined?cup.fuse(handle.cut(cavity)):handle.cut(cavity));
  const face=ref.faces.find(f=>['CONE','CYLINDRE'].includes(f.geomType)&&(()=>{const p=f.pointOnSurface(.5,.5),normal=f.normalAt(p);const inward=normal.toTuple()[0]>0; p.delete();normal.delete();return inward;})());
  assert.ok(face,'inner wall found');const p=face.pointOnSurface(.5,.5),selection={bodyId:'cup',point:p.toTuple()};
  const result=trimInterior(target,ref,selection);assert.ok(Math.abs(vol(result)-vol(expected))<Math.abs(vol(expected))*1e-4,'expected cut volume');
  const checkProbe=(point,inside)=>{const probe=transform(R.makeSphere(.15).translate(point)),overlap=result.intersect(probe);assert.ok(inside?Math.abs(vol(overlap)-vol(probe))<1e-6:Math.abs(vol(overlap))<1e-6,'probe '+point+' inside='+inside);probe.delete();overlap.delete();};
  checkProbe([15,0,15],false);checkProbe([15,0,35],false);checkProbe([34,0,15],true);checkProbe([34,0,35],true);
  if(joined){checkProbe([0,0,2],true);checkProbe([-(21.5+20*slope),0,25],true);checkProbe([-(19+20*slope),0,25],false);}
  if(slope&&joined&&!tilted){const mesh=target.mesh({tolerance:.08,angularTolerance:.15}),output={id:'cup',...mesh,planarFaces:target.faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:target.serialize()};const features=[{kind:'cadop',id:'fixture',name:'カップと取っ手',outputs:[output],remove:[]}];await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/trim-interior-test.json',JSON.stringify({format:'forma-cad',version:1,features}));const op=runOperation(features,{type:'trimInterior',id:'trim',target:'cup',faces:[selection]});assert.ok(Math.abs(vol(R.deserializeShape(op.outputs[0].brep).asShape3D())-vol(result))<1e-5);}
  for(const s of [p,result,ref,target,expected])s.delete();
 }
 const outerFace=cup.faces.find(f=>['CONE','CYLINDRE'].includes(f.geomType)&&f.normalAt(f.pointOnSurface(.5,.5)).toTuple()[0]<0);assert.throws(()=>trimInterior(handle,cup,{point:outerFace.pointOnSurface(.5,.5).toTuple()}),/外壁/);
 assert.throws(()=>trimInterior(cup,cup,{point:[-(20+20*slope),0,25]}),/はみ出しがありません/);
}
console.log('PASS cylindrical/conical, separate/joined, rotated cup; cut volumes, wall/floor probes, invalid selection and kernel output');
