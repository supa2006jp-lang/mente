import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';

// A valid BREP can still have missing or overlapping triangles after a boolean.
// Compare against exact CAD areas and volumes using native mesh positions.
export function solidMeshComplete(shape,mesh=cadMesh(shape)){
 const areas=new Map(),v=mesh.vertices,t=mesh.triangles;
 for(const group of mesh.faceGroups){
  let area=0;
  for(let i=group.start;i<group.start+group.count;i+=3){
   const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3,ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],vx=v[c]-v[a],vy=v[c+1]-v[a+1],vz=v[c+2]-v[a+2];
   area+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;
  }
  areas.set(group.faceId,(areas.get(group.faceId)||0)+area);
 }
 const faces=shape.faces;let polyhedral=true;
 try{
  for(const face of faces){
   const area=areas.get(face.hashCode);if(!(area>0))return false;
   const edges=face.edges;let straight;
   try{straight=face.geomType==='PLANE'&&edges.every(edge=>edge.geomType==='LINE');}finally{for(const edge of edges)edge.delete();}
   polyhedral&&=straight;
   // Curved boundaries have an intentional chord approximation in the mesh.
   if(straight){const expected=R.measureArea(face);if(Math.abs(area-expected)>Math.max(.001,expected*1e-5))return false;}
  }
  if(polyhedral){
   // Measure relative to the mesh so large world coordinates do not dominate
   // the small differences between vertices on a thin face.
   const [ox,oy,oz]=v;
   let sixVolume=0;
   for(let i=0;i<t.length;i+=3){
    const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3,ax=v[a],ay=v[a+1],az=v[a+2];
    const ux=v[b]-ax,uy=v[b+1]-ay,uz=v[b+2]-az,vx=v[c]-ax,vy=v[c+1]-ay,vz=v[c+2]-az;
    sixVolume+=(ax-ox)*(uy*vz-uz*vy)+(ay-oy)*(uz*vx-ux*vz)+(az-oz)*(ux*vy-uy*vx);
   }
   const expected=Math.abs(R.measureVolume(shape));if(Math.abs(Math.abs(sixVolume/6)-expected)>Math.max(.001,expected*1e-5))return false;
  }
  return true;
 }finally{for(const face of faces)face.delete();}
}
