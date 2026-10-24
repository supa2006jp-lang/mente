import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {STL_MESH} from './mesh-quality.js';
import {solidMeshComplete} from './solid-mesh.js';
import {inspectStlMesh} from './stl-mesh-health.js';
import {canonicalStlCadVertices} from './stl-cad-vertices.js';

// Every attempt deserializes independently. Never alter the document BREP,
// offset surfaces, fill a hole, fuse parts or modify the CAD topology to repair STL.
export function inspectCadStl(body,{onProgress,meshShape=cadMesh}={}){
 let first=null,best=null,bestScore=Infinity,attempts=0;
 for(const [attempt,options]of [STL_MESH,{tolerance:.01,angularTolerance:.08},{tolerance:.03,angularTolerance:.1}].entries()){
  let shape;attempts++;
  try{
   shape=R.deserializeShape(body.brep).asShape3D();
   const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);let valid;try{valid=analyzer.IsValid();}finally{analyzer.delete();}
   if(!valid)return {output:null,report:{id:body.id,ok:false,complete:true,triangles:0,removedDegenerate:0,issues:[{code:'invalid-cad'}],segments:[],attempts:attempt+1,repaired:false}};
   onProgress?.({stage:attempt?'STLの面を作り直して再検査しています':'STLの隙間・面の欠落を検査しています',bodyId:body.id});
   R.getOC().BRepTools.Clean(shape.wrapped,true);let mesh=meshShape(shape,options),audit=inspectStlMesh(mesh),adjustedVertices=0;const surfaceComplete=solidMeshComplete(shape,mesh),originalIssues=audit.issues;
   if(surfaceComplete&&audit.counts.boundary){
    try{const canonical=canonicalStlCadVertices(shape,mesh);if(canonical.adjustedVertices&&solidMeshComplete(shape,canonical.mesh)){mesh=canonical.mesh;adjustedVertices=canonical.adjustedVertices;audit=inspectStlMesh(mesh);}}catch{}
   }
   if(!surfaceComplete){audit.issues.push({code:'missing-surface'});audit.ok=false;}
   const {cleanTriangles,...details}=audit,report={id:body.id,...details,surfaceComplete,attempts:attempt+1,repaired:false};
   const output={id:body.id,...mesh,...(cleanTriangles?{triangles:cleanTriangles}:{})};
   if(!first)first={...report,issues:originalIssues};
   if(report.ok)return {output,report:{...report,repaired:attempt>0||audit.removedDegenerate>0||adjustedVertices>0,adjustedVertices,originalIssues:first.issues}};
   const score=audit.issues.reduce((n,i)=>n+(i.count||1000),0);if(score<bestScore){bestScore=score;best={output,report};}
   if(!audit.complete)break;
  }catch(error){if(!best)best={output:null,report:{id:body.id,ok:false,complete:false,triangles:0,removedDegenerate:0,issues:[{code:'remesh-failed'}],segments:[],repaired:false}};}
  finally{shape?.delete();}
 }
 return {...best,report:{...best.report,attempts}};
}
