import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {featureSolid,kernelBodies,runOperation} from '../src/kernel.js';
import {basisFor} from '../src/frames.js';
import {findRegions} from '../src/regions.js';
import {sketchExtrusionProgress,hideExtrudedSketches} from '../src/extruded-sketch-visibility.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const close=(a,b)=>assert(Math.abs(a-b)<.003,`${a} != ${b}`);
const sketch={...defaults,id:'outline',kind:'sketch',profile:'rect',name:'全体',width:60,height:40,groupId:'g',groupNumber:1,groupHidden:false};
const region=findRegions([sketch])[0];
const body={...defaults,id:'base',name:'押し出し済み',kind:'extrusion',width:30,height:40,x:15,depth:10};
const remaining={...defaults,id:'remaining',name:'未押し出し',kind:'extrusion',profile:'region',region,depth:6,
 unextrudedOnly:true,overlapOnly:true,overlapTargets:['base']};
function inspect(shape,expected){
 close(R.measureVolume(shape),expected);
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{assert(check.IsValid());}finally{check.delete();}
}
function withBodies(features,fn){const bodies=kernelBodies(features);try{return fn(bodies);}finally{for(const part of bodies.values())part.delete();}}
for(const operation of ['new','join']){
 const f={...remaining,operation,target:'base'};validateFeature(f);
 const result=runOperation([sketch,body],{type:'extrusionBatch',features:[f]});
 const made=result.features[0];
 withBodies([sketch,body,made],bodies=>{
  inspect(bodies.get(operation==='new'?'remaining':'base'),operation==='new'?7200:19200);
  if(operation==='new')inspect(bodies.get('base'),12000);
 });
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[sketch,body,made]})));
 assert.equal(saved.at(-1).unextrudedOnly,true);
 const edited=saved.map(f=>f.id==='remaining'?{...f,depth:8}:f);
 const replayed=runOperation(edited,{type:'replay',before:saved,start:2}).features;
 withBodies(replayed,bodies=>inspect(bodies.get(operation==='new'?'remaining':'base'),operation==='new'?9600:21600));
}
// The cut is planar and exact, including circles and holes; it is independent
// of extrusion direction and the visibility/display mesh of the original body.
for(const orientation of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},
 {plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const {n,u}=basisFor(orientation),base={...body,...orientation,x:u.x*15,y:u.y*15,z:u.z*15};
 for(const offset of [0,5,10])for(const extra of [{depth:6},{depth:-6},{depth:6,symmetric:true}]){
  const f={...remaining,...orientation,...extra,x:n.x*offset,y:n.y*offset,z:n.z*offset,region:{...region,...orientation,offset}};
  withBodies([base],bodies=>{const shape=featureSolid(f,bodies);try{inspect(shape,7200*(extra.symmetric?2:1));}finally{shape.delete();}});
 }
}
withBodies([{...body,width:10,x:0}],bodies=>{
 const shape=featureSolid(remaining,bodies);try{inspect(shape,50*40*6);assert.equal(shape.solids.length,2);}finally{shape.delete();}
});
const cylinder={...body,profile:'circle',diameter:20,x:0};
withBodies([cylinder],bodies=>{
 const shape=featureSolid(remaining,bodies);try{inspect(shape,(2400-Math.PI*100)*6);}finally{shape.delete();}
});
const bore={...defaults,id:'bore',kind:'extrusion',profile:'circle',diameter:8,operation:'cut',target:'base',depth:10};
withBodies([cylinder,bore],bodies=>{
 const shape=featureSolid(remaining,bodies);try{inspect(shape,(2400-Math.PI*(100-16))*6);}finally{shape.delete();}
});
withBodies([{...body,width:60,x:0}],bodies=>assert.throws(()=>featureSolid(remaining,bodies),/未押し出しの部分がありません/));
withBodies([{...body,z:30}],bodies=>{const shape=featureSolid(remaining,bodies);try{inspect(shape,14400);}finally{shape.delete();}});
withBodies([body,{...body,id:'left',x:-15,width:10}],bodies=>{
 const shape=featureSolid({...remaining,overlapTargets:['base','left']},bodies);try{inspect(shape,20*40*6);}finally{shape.delete();}
});
// Native partial extrusions must not mark a whole source contour complete.
const partial={...remaining,unextrudedOnly:false};
assert.equal(sketchExtrusionProgress([sketch,body,partial]).get('g').done,0);
assert.equal(hideExtrudedSketches([sketch,body],[partial])[0].groupHidden,false);
assert.equal(sketchExtrusionProgress([sketch,body,partial,remaining]).get('g').done,1);
assert.equal(hideExtrudedSketches([sketch,body,partial],[remaining])[0].groupHidden,true);
for(const change of [{unextrudedOnly:'yes'},{overlapOnly:false},{operation:'cut'},{mode:'thin'},{overlapTargets:[]}]){
 assert.throws(()=>validateFeature({...remaining,...change}));
}
console.log('PASS remaining-only new/join, original preservation, disconnected patches, native arcs and holes, signed/symmetric axes, complete/empty sections, save/replay and source progress');
