// Replicad's renderer extractor converts native doubles to Float32 before
// returning them. Read just the positions from those cached triangulations;
// the extractor already supplies the render normals and triangle topology.
import * as R from 'replicad';
import {measurePhase} from './phase-timings.js';
import {cadSubshapes} from './cad-topology.js';
export function cadMesh(shape,options={tolerance:.08,angularTolerance:.15}){return measurePhase('display',()=>{
 const mesh=shape.mesh(options),faces=cadSubshapes(shape,'face'),vertices=[],oc=R.getOC();
 try{
  for(const face of faces){
   const location=new oc.TopLoc_Location();let triangulation,transform;
   try{
    triangulation=oc.BRep_Tool.Triangulation(face.wrapped,location,0);if(!triangulation||triangulation.isNull())continue;
    if(!location.IsIdentity())transform=location.Transformation();
    const count=triangulation.NbNodes();
    for(let i=1;i<=count;i++){
     const node=triangulation.Node(i);let point;
     try{
      point=transform?node.Transformed(transform):node;
      vertices.push(point.X(),point.Y(),point.Z());
     }finally{if(point&&point!==node)point.delete();node.delete();}
    }
   }finally{transform?.delete();triangulation?.delete();location.delete();}
  }
  if(vertices.length!==mesh.vertices.length||vertices.some((value,i)=>Math.fround(value)!==mesh.vertices[i]))throw Error('作図用の精密な座標を取得できませんでした');
  return {...mesh,vertices};
 }finally{faces.forEach(face=>face.delete());}
});}
