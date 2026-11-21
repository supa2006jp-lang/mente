import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {selectedCadFaces} from '../src/face-pull.js';
import {runOperation} from '../src/kernel.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const depth=15.5,thickness=2;
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-6,a+' != '+b);
function distance(shape,point){
 const vertex=R.makeVertex(point);
 try{return R.measureDistanceBetween(vertex,shape);}
 finally{vertex.delete();}
}

function facetedPrism(height){
 const ring=[[0,0,0],[90,0,0]];
 for(let i=63;i>0;i--){
  const t=i/64;
  ring.push([90*t,17*Math.sin(Math.PI*t)+1.2*Math.sin(5*Math.PI*t),0]);
 }
 const face=R.makePolygon(ring),vector=new R.Vector([0,0,height]);
 try{return R.basicFaceExtrusion(face,vector);}
 finally{face.delete();vector.delete();}
}
function savedPrism(base){
 return [{kind:'cadop',id:'prism',name:'Test prism',remove:[],outputs:[{id:'body',brep:base.serialize()}]}];
}
function opening(point,normal){
 return {bodyId:'body',point,normal};
}
function shellPreview(features,faces,direction='内側'){
 return runOperation(features,{type:'preview',operation:{type:'shell',id:'shell',target:'body',thickness,direction,faces}});
}
function closedSTL(output){
 const {report}=inspectCadStl(output);
 assert.ok(report.ok,JSON.stringify(report.issues));
}

test('a faceted prism uses the native profile inset when the ordinary shell removes no material',()=>{
 const base=facetedPrism(depth);
 const top={bodyId:'body',point:[45,9,depth],normal:[0,0,1]};
 const bottom={bodyId:'body',point:[45,9,0],normal:[0,0,-1]};
 const features=savedPrism(base);
 const openings=selectedCadFaces(base,[top]);
 try{
  const trial=base.shell(thickness,finder=>finder.inList(openings));
  try{near(R.measureVolume(trial),R.measureVolume(base));}
  finally{trial.delete();}
  for(const both of [false,true]){
   const result=shellPreview(features,both?[top,bottom]:[top]),[output]=result.outputs;
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
    closedSTL(output);
   }finally{shape.delete();}
  }
 }finally{openings.forEach(opening=>opening.delete());base.delete();}
});

test('two cavities next to a through-slot preserve the thin webs and both requested openings',()=>{
 const stock=R.makeBox([0,0,0],[52,20,14]),slot=R.makeBox([22,2,-1],[29,18,15]),base=stock.cut(slot);
 try{
  const top=opening([10,10,14],[0,0,1]),bottom=opening([10,10,0],[0,0,-1]),features=savedPrism(base);
  for(const both of [false,true]){
   const result=shellPreview(features,both?[top,bottom]:[top]),[output]=result.outputs;
   const shape=R.deserializeShape(output.brep).asShape3D();
   try{
    assert.equal(output.shapeMetrics.solids,1);
    assert.deepEqual(output.shapeMetrics.bounds,[[0,0,0],[52,20,14]]);
    for(const x of [10,41]){
     near(distance(shape,[x,10,14]),8);
     near(distance(shape,[x,10,0]),both?8:0);
     if(!both)near(distance(shape,[x,10,2.02]),.02);
    }
    const web=R.makeBox([24.9,.9,6.9],[25.1,1.1,7.1]),kept=shape.intersect(web);
    try{near(R.measureVolume(kept),R.measureVolume(web));}
    finally{kept.delete();web.delete();}
    near(distance(shape,[25,12,7]),3);
    near(distance(shape,[10,2.02,7]),.02);
    assert.equal(result.removed.length,1);
    const cavities=inspectStlMesh(result.removed[0],{includeComponents:true});
    assert.ok(cavities.ok);
    assert.equal(cavities.components.length,2);
    near(cavities.volume,592*(both?14:12));
    closedSTL(output);
   }finally{shape.delete();}
  }
 }finally{base.delete();slot.delete();stock.delete();}
});

test('faceted shells preserve round and square through-holes and export their actual wall geometry',()=>{
 for(const circular of [false,true]){
  const stock=facetedPrism(14),tool=circular?R.makeCylinder(2.2,16,[46,10,-1]):R.makeBox([43,8,-1],[47,12,15]);
  const base=stock.cut(tool);
  try{
   const features=savedPrism(base),top=opening([32,8,14],[0,0,1]),bottom=opening([32,8,0],[0,0,-1]);
   const boreX=circular?46:45,boreRadius=circular?2.2:2;
   for(const both of [false,true]){
    const result=shellPreview(features,both?[top,bottom]:[top]),[output]=result.outputs;
    const shape=R.deserializeShape(output.brep).asShape3D();
    try{
     assert.equal(output.shapeMetrics.solids,both?2:1);
     assert.ok(distance(shape,top.point)>2);
     if(both){
      assert.ok(distance(shape,bottom.point)>2);
      const findings=result.analysis.geometryHealth.rows.flatMap(row=>row.findings);
      assert.ok(findings.some(finding=>finding.code==='disconnected'&&finding.count===2));
     }else{
      near(distance(shape,bottom.point),0);
      near(distance(shape,[32,8,2.02]),.02);
     }
     near(distance(shape,[boreX,10,7]),boreRadius);
     near(distance(shape,[boreX,10-boreRadius-2.02,7]),.02);
     closedSTL(output);
    }finally{shape.delete();}
   }
   const [output]=shellPreview(features,[top],'外側').outputs;
   const exterior=R.deserializeShape(output.brep).asShape3D();
   try{
    near(distance(exterior,[32,.02,7]),.02);
    near(distance(exterior,[32,8,.02]),.02);
    near(distance(exterior,[boreX,10,7]),boreRadius-2);
    closedSTL(output);
   }finally{exterior.delete();}
  }finally{base.delete();tool.delete();stock.delete();}
 }
});
