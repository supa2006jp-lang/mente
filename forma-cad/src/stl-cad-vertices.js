import * as R from 'replicad';

// Face triangulations evaluate a shared CAD vertex on different surfaces. After
// rotation their last floating-point bits can differ, especially near zero.
// Restore only polygon ENDPOINTS to their own incident CAD vertex. No spatial
// welding between edges, vertices, solids or nearby independent surfaces.
export function canonicalStlCadVertices(shape,mesh){
 const oc=R.getOC(),faces=shape.faces,vertices=mesh.vertices.slice(),assignments=new Map();let offset=0,adjustedVertices=0;
 const scale=Math.max(1,...shape.boundingBox.bounds.flat().map(Math.abs)),epsilon=128*Number.EPSILON*scale;
 try{
  for(const face of faces){
   const location=new oc.TopLoc_Location();let triangulation,transform;const edges=[];
   try{
    triangulation=oc.BRep_Tool.Triangulation(face.wrapped,location,0);if(!triangulation||triangulation.isNull())continue;
    transform=location.Transformation();const count=triangulation.NbNodes();if((offset+count)*3>vertices.length)return {mesh,adjustedVertices:0};
    edges.push(...face.edges);
    for(const edge of edges){
     let polygon;const endpoints=[],explorer=new oc.TopExp_Explorer(edge.wrapped,oc.TopAbs_ShapeEnum.TopAbs_VERTEX,oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
     try{
      polygon=oc.BRep_Tool.PolygonOnTriangulation(edge.wrapped,triangulation,location);if(!polygon||polygon.isNull()||polygon.NbNodes()<2)continue;
      for(;explorer.More();explorer.Next()){
       const vertex=R.cast(explorer.Current());if(endpoints.some(v=>v.vertex.isSame(vertex))){vertex.delete();continue;}
       const p=oc.BRep_Tool.Pnt(vertex.wrapped);try{endpoints.push({vertex,point:[p.X(),p.Y(),p.Z()]});}finally{p.delete();}
      }
      for(const end of [1,polygon.NbNodes()]){
       const index=polygon.Node(end);if(index<1||index>count)continue;const slot=(offset+index-1)*3,node=triangulation.Node(index);let world;
       try{world=node.Transformed(transform);const raw=[world.X(),world.Y(),world.Z()];
        // A custom or damaged mesh must never borrow a CAD endpoint to hide it.
        if(raw.some((v,k)=>v!==mesh.vertices[slot+k]))continue;
        const matches=endpoints.filter(v=>Math.hypot(...v.point.map((p,k)=>p-raw[k]))<=epsilon);if(matches.length!==1)continue;const match=matches[0],previous=assignments.get(slot);
        if(previous&&!previous.vertex.isSame(match.vertex))return {mesh,adjustedVertices:0};
        if(!previous)assignments.set(slot,{vertex:match.vertex.clone(),point:match.point});
       }finally{world?.delete();node.delete();}
      }
     }finally{explorer.delete();polygon?.delete();endpoints.forEach(v=>v.vertex.delete());}
    }
    offset+=count;
   }finally{edges.forEach(e=>e.delete());transform?.delete();triangulation?.delete();location.delete();}
  }
  if(offset*3!==vertices.length)return {mesh,adjustedVertices:0};
  for(const [slot,{point}]of assignments){if(point.some((v,k)=>v!==vertices[slot+k])){for(let k=0;k<3;k++)vertices[slot+k]=point[k];adjustedVertices++;}}
  return {mesh:adjustedVertices?{...mesh,vertices}:mesh,adjustedVertices};
 }finally{assignments.forEach(v=>v.vertex.delete());faces.forEach(f=>f.delete());}
}
