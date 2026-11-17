import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,makeGeometry,volume,validateFeature,validateProject} from '../src/geometry.js';
import {featureSolid,kernelBodies,runOperation} from '../src/kernel.js';
import {basisFor} from '../src/frames.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const close=(a,b)=>assert(Math.abs(a-b)<.005,`${a} != ${b}`),ring=(r,count=96)=>Array.from({length:count},(_,i)=>[r*Math.cos(i*2*Math.PI/count),r*Math.sin(i*2*Math.PI/count)]);
for(const orientation of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},
 {plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}])for(const os of [-2,2])for(const symmetric of [false,true]){
 const n=basisFor(orientation).n,region={...orientation,id:'r',offset:7,outer:[[-20,-10],[20,-10],[20,10],[-20,10]],holes:[],sourceIds:[],area:800};
 const f={...defaults,...orientation,id:'os',kind:'extrusion',profile:'region',region,profileOffset:os,depth:-3,symmetric,x:n.x*7,y:n.y*7,z:n.z*7};
 const shape=featureSolid(f,new Map()),g=makeGeometry(f),expected=(40+os*2)*(20+os*2)*3*(symmetric?2:1);
 try{close(R.measureVolume(shape),expected);close(volume(g),expected);const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}}finally{shape.delete();g.dispose();}
}
for(const os of [-1,1]){
 const region={id:'ring',plane:'XY',offset:0,outer:ring(10),holes:[ring(4).reverse()],sourceIds:[],area:Math.PI*84};
 const f={...defaults,id:'ring-os',kind:'extrusion',profile:'region',region,profileOffset:os,depth:3},shape=featureSolid(f,new Map());
 try{close(R.measureVolume(shape),Math.PI*((10+os)**2-(4-os)**2)*3);}finally{shape.delete();}
}
const base={...defaults,id:'base',name:'円柱',kind:'extrusion',profile:'circle',diameter:20,depth:10};
const region={id:'face',bodyId:'base',cadFace:{bodyId:'base',point:[0,0,10],normal:[0,0,1]},plane:'XY',offset:10,outer:ring(10),holes:[],sourceIds:[],area:Math.PI*100};
for(const operation of ['new','join','cut']){
 const f={...defaults,id:'face-os',name:'OS押出',kind:'extrusion',profile:'region',region,profileOffset:-2,z:10,depth:operation==='cut'?-3:3,operation,target:'base'};
 const result=runOperation([base],{type:'extrusionBatch',features:[f]});
 const expected=operation==='new'?Math.PI*64*3:Math.PI*100*10+(operation==='join'?1:-1)*Math.PI*64*3;
 const shape=R.deserializeShape(result.features[0].cadResult.outputs[0].brep).asShape3D();try{close(R.measureVolume(shape),expected);}finally{shape.delete();}
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[base,...result.features]})));
 assert.equal(saved[1].profileOffset,-2);
 const edited=saved.map((feature,i)=>i?{...feature,profileOffset:-1}:feature),replay=runOperation(edited,{type:'replay',before:saved,start:1}).features,bodies=kernelBodies(replay);
 try{close(R.measureVolume(bodies.get(operation==='new'?f.id:'base')),operation==='new'?Math.PI*81*3:Math.PI*100*10+(operation==='join'?1:-1)*Math.PI*81*3);}finally{for(const body of bodies.values())body.delete();}
}
for(const profileOffset of [NaN,Infinity,'-2',10001])assert.throws(()=>validateFeature({...defaults,id:'invalid',kind:'extrusion',profileOffset}));
const shrinking={...defaults,id:'collapsed',kind:'extrusion',profile:'region',region:{id:'r',plane:'XY',offset:0,outer:[[-20,-10],[20,-10],[20,10],[-20,10]],holes:[],sourceIds:[],area:800},profileOffset:-11,depth:3};
assert.throws(()=>{const shape=featureSolid(shrinking,new Map());shape.delete();},/OS距離|輪郭|領域/,'an offset beyond collapse must not create an inverted contour');
console.log('PASS OS inward/outward, signed/symmetric axes, native circle and hole offsets, selected CAD faces, new/join/cut, save/reload and history replay');
