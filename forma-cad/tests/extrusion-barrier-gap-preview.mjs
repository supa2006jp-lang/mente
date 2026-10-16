import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,volume} from '../src/geometry.js';
import {barrierExtrusion,barrierGapShape} from '../src/extrusion-barrier.js';
import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const f={...defaults,id:'barrier',name:'バリア押し出し',kind:'extrusion',width:40,height:30,depth:15,barrier:true,barrierGap:.4};
const obstacle=R.makeCylinder(5,25,[0,0,0]),tool=R.makeBox([-20,-15,0],[20,15,15]),bodies=new Map([['obstacle',obstacle]]);
const seed={kind:'cadop',id:'seed',name:'障害物',remove:[],outputs:[{id:'obstacle',...obstacle.mesh(),brep:obstacle.serialize()}]},snapshot=obstacle.serialize();
for(const gap of [.2,.4,.8]){
 const info={},result=barrierExtrusion(tool,bodies,{...f,barrierGap:gap},info),space=barrierGapShape(tool,result,[obstacle]);
 try{
  assert.equal(info.barrierClearance.length,1);assert.equal(info.barrierClearanceWarning,undefined);
  const originalOverlap=space.intersect(obstacle),solidOverlap=space.intersect(result);try{near(R.measureVolume(originalOverlap),0);near(R.measureVolume(solidOverlap),0);}finally{originalOverlap.delete();solidOverlap.delete();}
  near(R.measureVolume(space),Math.PI*((5+gap)**2-25)*15,1e-5);
  const mesh=info.barrierClearance[0],g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
  try{near(Math.abs(volume(g)),R.measureVolume(space),.5);}finally{g.dispose();}
  near(R.measureDistanceBetween(result,obstacle),gap);
 }finally{space.delete();result.delete();}
}
const actual=runOperation([seed],{type:'extrusion',feature:f}),preview=runOperation([seed],{type:'extrusionToolPreview',feature:f});
assert.equal(preview.barrierClearance.length,1);assert.equal(actual.barrierClearance,undefined);assert.equal(actual.outputs[0].barrierClearance,undefined);
assert.equal(runOperation([seed],{type:'extrusionToolPreview',feature:{...f,barrierGap:0}}).barrierClearance,undefined);
const far=obstacle.clone().translate([100,0,0]),emptyInfo={},unmodified=barrierExtrusion(tool,new Map([['far',far]]),f,emptyInfo);assert.equal(emptyInfo.barrierClearance,undefined);near(R.measureVolume(unmodified),18000);unmodified.delete();far.delete();
// A display-only failure cannot change the already validated extrusion.
const originalCut=R.Solid.prototype.cut;
try{
 R.Solid.prototype.cut=function(other){if(R.measureVolume(other)>10000)throw Error('gap display failed');return originalCut.call(this,other);};
 const info={},result=barrierExtrusion(tool,bodies,f,info);try{assert.ok(info.barrierClearanceWarning);assert.equal(info.barrierClearance,undefined);near(R.measureDistanceBetween(result,obstacle),.4);}finally{result.delete();}
 R.Solid.prototype.cut=function(other){if(R.measureVolume(other)>10000)throw new WebAssembly.RuntimeError('memory access out of bounds');return originalCut.call(this,other);};
 assert.throws(()=>barrierExtrusion(tool,bodies,f,{}),WebAssembly.RuntimeError);
}finally{R.Solid.prototype.cut=originalCut;}
assert.equal(obstacle.serialize(),snapshot);
await fs.writeFile('.sites-runtime/extrusion-barrier-gap-preview-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[seed,{...f,cadResult:actual}]}));
obstacle.delete();tool.delete();console.log('PASS exact clearance-only colour volume, exclusion of obstacle and extrusion, live gap sizes, preview-only meshes, zero/unaffected cases, safe overlay fallback, fatal propagation and unchanged obstacle');
