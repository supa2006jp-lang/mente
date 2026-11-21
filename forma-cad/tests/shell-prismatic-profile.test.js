import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {selectedCadFaces} from '../src/face-pull.js';
import {runOperation} from '../src/kernel.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

const depth=15.5,thickness=2;
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-6,a+' != '+b);
function distance(shape,point){
 const vertex=R.makeVertex(point);
 try{return R.measureDistanceBetween(vertex,shape);}
 finally{vertex.delete();}
}

test('a faceted prism uses the native profile inset when the ordinary shell removes no material',async()=>{
 R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const ring=[[0,0,0],[90,0,0]];
 for(let i=63;i>0;i--){
  const t=i/64;
  ring.push([90*t,17*Math.sin(Math.PI*t)+1.2*Math.sin(5*Math.PI*t),0]);
 }
 const face=R.makePolygon(ring),vector=new R.Vector([0,0,depth]),base=R.basicFaceExtrusion(face,vector);
 face.delete();vector.delete();
 const top={bodyId:'body',point:[45,9,depth],normal:[0,0,1]};
 const bottom={bodyId:'body',point:[45,9,0],normal:[0,0,-1]};
 const features=[{kind:'cadop',id:'prism',name:'Faceted prism',remove:[],outputs:[{id:'body',brep:base.serialize()}]}];
 const openings=selectedCadFaces(base,[top]);
 try{
  const trial=base.shell(thickness,finder=>finder.inList(openings));
  try{near(R.measureVolume(trial),R.measureVolume(base));}
  finally{trial.delete();}
  for(const both of [false,true]){
   const operation={type:'shell',id:'shell',target:'body',thickness,direction:'内側',faces:both?[top,bottom]:[top]};
   const result=runOperation(features,{type:'preview',operation}),[output]=result.outputs;
   const shape=R.deserializeShape(output.brep).asShape3D();
   try{
    assert.equal(output.shapeMetrics.solids,1);
    assert.equal(output.id,'body');
    assert.ok(distance(shape,top.point)>thickness);
    if(both)assert.ok(distance(shape,bottom.point)>thickness);
    else{
     near(distance(shape,bottom.point),0);
     near(distance(shape,[45,9,thickness+.02]),.02);
    }
    near(distance(shape,[45,thickness+.02,depth/2]),.02);
    assert.equal(result.removed.length,1);
    const z=result.removed[0].vertices.filter((_,i)=>i%3===2);
    near(Math.min(...z),both?0:thickness);
    near(Math.max(...z),depth);
    const audit=inspectCadStl(output);
    assert.ok(audit.report.ok,JSON.stringify(audit.report.issues));
   }finally{shape.delete();}
  }
 }finally{openings.forEach(opening=>opening.delete());base.delete();}
});
