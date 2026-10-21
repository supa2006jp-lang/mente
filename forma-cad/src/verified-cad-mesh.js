import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {solidMeshComplete} from './solid-mesh.js';
import {repairStraightPlanarMesh} from './planar-mesh-repair.js';

// Boolean results can retain incomplete triangulations on valid exact faces.
// Retry only the display mesh, on independent topology: shallow clones share
// input faces and must not be cleaned in place.
export function verifiedCadMesh(shape,options={tolerance:.08,angularTolerance:.15}){
 const mesh=cadMesh(shape,options);
 if(solidMeshComplete(shape,mesh))return mesh;
 const fresh=R.deserializeShape(shape.serialize()).asShape3D();
 try{
  R.getOC().BRepTools.Clean(fresh.wrapped,true);
  let rebuilt=cadMesh(fresh,options);
  if(!solidMeshComplete(fresh,rebuilt))rebuilt=repairStraightPlanarMesh(fresh,rebuilt);
  if(!solidMeshComplete(fresh,rebuilt))throw Error('押し出し後の面を正常に表示できませんでした。元のボディは変更していません');
  if(rebuilt.planarFaces)return rebuilt;
  const faces=fresh.faces;
  try{return {...rebuilt,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode)};}
  finally{faces.forEach(f=>f.delete());}
 }finally{fresh.delete();}
}
