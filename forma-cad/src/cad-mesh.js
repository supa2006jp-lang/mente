// Replicad's renderer extractor converts native doubles to Float32 before
// returning them. Read the same cached face triangulations without that cast.
export function cadMesh(shape,options={tolerance:.08,angularTolerance:.15}){
 shape.mesh(options);
 const faces=shape.faces,vertices=[],normals=[],triangles=[],faceGroups=[];
 try{
  for(const face of faces){
   const part=face.triangulation(vertices.length/3);if(!part?.trianglesIndexes.length)continue;
   faceGroups.push({start:triangles.length,count:part.trianglesIndexes.length,faceId:face.hashCode});
   for(const value of part.vertices)vertices.push(value);
   for(const value of part.verticesNormals)normals.push(value);
   for(const value of part.trianglesIndexes)triangles.push(value);
  }
  return {vertices,normals,triangles,faceGroups};
 }finally{faces.forEach(face=>face.delete());}
}
