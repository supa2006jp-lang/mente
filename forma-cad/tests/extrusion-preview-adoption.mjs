import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {ExtrusionPreviewCache} from '../src/extrusion-preview-cache.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const seed=(id,shape)=>{try{return {id,kind:'cadop',name:id,outputs:[{id,...shape.mesh(),brep:shape.serialize()}],remove:[]};}finally{shape.delete();}};
const source=seed('source',R.makeBox([-10,-10,-3],[10,10,0]));
const obstacle=seed('obstacle',R.makeCylinder(3,6,[0,0,8]));
const prefix=[source,obstacle],f={...defaults,id:'barrier',name:'バリア押し出し',kind:'extrusion',width:20,height:20,depth:25,operation:'join',target:'source',barrier:true,barrierGap:.4};
const original={...f,cadResult:runOperation(prefix,{type:'extrusion',target:f.target,feature:f})};
const move={type:'move',target:'source',rotation:[0,0,0],x:5,y:0,z:0};
const before=[...prefix,original,{kind:'cadop',id:'move',name:'後続の移動',spec:move,...runOperation([...prefix,original],move)}];
const snapshot=JSON.stringify(before),edited={...f,barrierGap:.8};
const preview=runOperation(prefix,{type:'preview',operation:{type:'extrusion',target:f.target,feature:edited}});
const cache=new ExtrusionPreviewCache();cache.store(before,[edited],[{...edited,cadResult:preview}],f.id);
const ready=cache.get(before,[edited],f.id);assert.ok(ready);
const proposed=structuredClone(before);proposed[2]=ready.features[0];
const result=runOperation(proposed,{type:'replay',before,start:3,refreshStart:true}).features;
assert.equal(result[2].cadResult.outputs[0].brep,preview.outputs[0].brep,'adopt the exact prepared BREP without recomputing the edited extrusion');
const shape=R.deserializeShape(result[3].outputs.find(output=>output.id==='source').brep).asShape3D();
const shiftedObstacle=R.makeCylinder(3,6,[5,0,8]);
try{
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{assert.ok(check.IsValid());}finally{check.delete();}
 assert.ok(Math.abs(R.measureDistanceBetween(shape,shiftedObstacle)-.8)<1e-5,'successor moves the updated cavity, preserving the new gap');
 const bounds=shape.boundingBox;try{assert.ok(Math.abs(bounds.bounds[0][0]+5)<1e-5);}finally{bounds.delete();}
}finally{shape.delete();shiftedObstacle.delete();}
validateProject({format:'forma-cad',version:1,features:result});
assert.equal(JSON.stringify(before),snapshot,'replaying successors preserves the previous document');
console.log('PASS adopt exact joined barrier BREP, replay successors only, preserve geometry/gap, validate saved history and immutable source');
