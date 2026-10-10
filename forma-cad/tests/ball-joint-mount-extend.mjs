import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
const info={radius:12,height:40},initial=ballJointDefaults(info);
assert.equal(initial.mountAutoExtend,true);
assert.equal(ballJointSettings(info,{}).mountAutoExtend,false,'old saves retain their geometry');
const basic=ballJointSettings(info,{...initial,mountThread:true});
assert.equal(basic.mountPitch,3);assert.equal(basic.mountLength,2.8);assert.equal(basic.mountThreadLength,6.2);
assert.equal(basic.baseExtensions.ball,0);assert.ok(basic.baseExtensions.socket>3.38);
for(const side of ['ball','socket','both']){
 const s=ballJointSettings(info,{...initial,mountThread:true,mountSide:side,mountLength:12,neckExtension:7});
 for(const role of ['ball','socket']){
  const selected=side==='both'||side===role;
  assert.equal(s.baseExtensions[role]>0,selected,'only selected bases grow');
  const height=role==='ball'?s.ballBaseHeight:s.socketBaseHeight;
  if(selected)assert.ok(height>=s.mountThreadLength+1.2-1e-7);
 }
 assert.equal(s.lowerEnd,basic.lowerEnd);assert.equal(s.socketTop,basic.socketTop);
}
assert.throws(()=>ballJointSettings(info,{...initial,mountThread:true,mountAutoExtend:false}),/6.2 mm以上/);
assert.throws(()=>ballJointSettings(info,{...initial,mountThread:true,mountLength:12,mountAutoExtend:false}),/土台が短すぎ/);
assert.throws(()=>ballJointSettings(info,{...initial,mountAutoExtend:'yes'}),/自動延長/);
assert.deepEqual(ballJointSettings(info,{...initial,mountThread:false,mountLength:100}).baseExtensions,{ball:0,socket:0});
console.log('PASS extension dimensions, selected sides, unchanged joint coordinates, manual/legacy opt-out and disabled option');
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40};
const p={...initial,type:'ballJoint',target:'c',id:'joint',pose:'assembled',mountThread:true,mountLength:12,neckExtension:7,fixHole:true,fixSide:'both',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4,fixSocketDiameter:4,fixSocketPitch:.7,fixSocketDepth:4};
const s=ballJointSettings(info,p),result=runOperation([source],p,p=>console.log(p.stage));
const shapes=result.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
const volume=shape=>Math.abs(R.measureVolume(shape));
function same(a,b){const ab=a.cut(b),ba=b.cut(a);try{assert.ok(volume(ab)+volume(ba)<1e-4);}finally{ab.delete();ba.delete();}}
for(const shape of shapes){
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
 try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(x=>x.delete());}
}
assert.ok(result.analysis.overlap.every(v=>v<1e-5));
assert.deepEqual(result.analysis.baseExtensions,s.baseExtensions);
assert.equal(result.analysis.ballBaseHeight,s.ballBaseHeight);
for(const [i,start,direction] of [[0,s.ballBaseStart,1],[1,s.socketBaseEnd,-1]]){
 const box=shapes[i].boundingBox;try{assert.ok(Math.abs(box.bounds[direction===1?0:1][2]-start)<1e-4);}finally{box.delete();}
 const bore=R.makeCylinder(1.2,3,[0,0,start+direction*.1],[0,0,direction]),hit=shapes[i].intersect(bore);
 try{assert.ok(volume(hit)<1e-5,'fixed holes follow the extended end faces');}finally{hit.delete();bore.delete();}
 assert.equal(result.analysis.fixingHoles[i].start,start);
 assert.equal(result.analysis.mountingThreads[i].length,12);
}
console.log('PASS extended bases with external threads and relocated internal threads: valid solids, complete mesh and no joint interference');
const original=runOperation([source],{...p,mountThread:false,fixHole:false});
const oldShapes=original.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
same(shapes[2],oldShapes[2]);
for(const [i,lo,hi]of [[0,s.lowerEnd-s.neckExtension+.1,s.splitPosition+s.r+.1],[1,s.mouth-.1,s.socketTop-.1]]){
 const region=R.makeCylinder(30,hi-lo,[0,0,lo]),a=shapes[i].intersect(region),b=oldShapes[i].intersect(region);
 try{same(a,b);}finally{a.delete();b.delete();region.delete();}
}
console.log('PASS ball, rod, socket clamping region and nut geometry unchanged');
const feature={kind:'cadop',id:'joint',name:'土台自動延長',spec:p,...result};
validateProject({format:'forma-cad',version:1,features:[source,feature]});
const repeat=runOperation([source],p);
assert.deepEqual(repeat.analysis.baseExtensions,result.analysis.baseExtensions,'recompute does not accumulate extension');
const printed=runOperation([source],{...p,pose:'print'});
for(const o of printed.outputs)assert.ok(Math.abs(o.vertices.reduce((min,v,i)=>i%3===2?Math.min(v,min):min,Infinity))<1e-5);
for(const plane of ['XZ','YZ']){
 const turned=runOperation([{...source,plane,x:7,y:-3,z:9}],p);
 assert.deepEqual(turned.analysis.baseExtensions,s.baseExtensions);assert.ok(turned.analysis.overlap.every(v=>v<1e-5));
}
console.log('PASS persistence, idempotent recompute, print placement and rotated cylinder axes');
[...shapes,...oldShapes].forEach(s=>s.delete());
