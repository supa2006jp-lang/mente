import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';
import {runOperation,runInternalThreadShape} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const block={...defaults,id:'support',width:20,height:20,depth:5},hole={...defaults,id:'hole',profile:'circle',diameter:10,depth:-5,z:5,operation:'cut',target:'support',hole:true};
const spec={type:'thread',target:'support',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,2.5],threadFaceOffsets:[-.3,-.3,-.3,0],threadCylinderOffset:-.3};
const expected=R.deserializeShape(runOperation([block,hole],spec).outputs[0].brep).asShape3D();
const restores=[],counts={mesh:0,serialize:0};
for(const name of ['mesh','serialize']){let proto=R.Solid.prototype;while(!Object.hasOwn(proto,name))proto=Object.getPrototypeOf(proto);const old=proto[name];proto[name]=function(...args){counts[name]++;return old.apply(this,args);};restores.push(()=>proto[name]=old);}
let native;try{native=runInternalThreadShape([block,hole],spec);assert.deepEqual(counts,{mesh:0,serialize:0},'intermediate thread must not generate display or BREP data');}finally{restores.reverse().forEach(fn=>fn());}
try{
 const check=new (R.getOC().BRepCheck_Analyzer)(native.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}
 assert.ok(Math.abs(R.measureVolume(native)-R.measureVolume(expected))<1e-6);
 for(const [a,b] of [[native,expected],[expected,native]]){const delta=a.cut(b);try{assert.ok(Math.abs(R.measureVolume(delta))<1e-6);}finally{delta.delete();}}
 const faces=native.faces;try{assert.ok(faces.some(f=>f.geomType==='BSPLINE_SURFACE'));}finally{faces.forEach(f=>f.delete());}
}finally{native.delete();expected.delete();}
assert.throws(()=>runInternalThreadShape([block],{type:'extrusion'}),/条件/);assert.throws(()=>runInternalThreadShape([block],{...spec,target:'missing'}));
console.log('PASS native intermediate thread, zero display/save calls, exact bidirectional volume equivalence, valid helical shape, independent ownership and rejected invalid calls');
