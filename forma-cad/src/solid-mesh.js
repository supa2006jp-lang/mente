import * as R from 'replicad';
// A valid BREP can still have missing or overlapping triangles after a boolean.
export function solidMeshComplete(shape,mesh=shape.mesh({tolerance:.08,angularTolerance:.15})){
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
   let signed=0;
   for(let i=0;i<t.length;i+=3){const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;signed+=(v[a]*(v[b+1]*v[c+2]-v[b+2]*v[c+1])+v[a+1]*(v[b+2]*v[c]-v[b]*v[c+2])+v[a+2]*(v[b]*v[c+1]-v[b+1]*v[c]))/6;}
   const expected=Math.abs(R.measureVolume(shape));if(Math.abs(Math.abs(signed)-expected)>Math.max(.001,expected*1e-5))return false;
  }
  return true;
 }finally{for(const face of faces)face.delete();}
}
