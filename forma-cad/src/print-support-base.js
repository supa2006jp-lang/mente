import * as R from 'replicad';

const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};

// Native plane checks keep holes and concave platforms out of the landing area.
// Final solid clearance still rejects non-planar obstacles and side walls.
export function supportBaseSurfaces(bodies){
 const surfaces=[];
 try{
  for(const [bodyId,shape]of bodies){const faces=shape.faces;try{for(const face of faces){if(face.geomType!=='PLANE')continue;const normal=tuple(face.normalAt());if(normal[2]<.5)continue;surfaces.push({bodyId,face:face.clone(),normal,point:tuple(face.center),bounds:bounds(face)});}}finally{faces.forEach(f=>f.delete());}}
  return {find(point,bedZ){
   let best={kind:'bed',point:[point[0],point[1],bedZ],normal:[0,0,1]};
   for(const s of surfaces){const [x,y]=point;if(x<s.bounds[0][0]-1e-5||x>s.bounds[1][0]+1e-5||y<s.bounds[0][1]-1e-5||y>s.bounds[1][1]+1e-5)continue;
    const z=s.point[2]-(s.normal[0]*(x-s.point[0])+s.normal[1]*(y-s.point[1]))/s.normal[2];if(z<=best.point[2]+1e-5||z>=point[2]-1e-5)continue;
    const vertex=R.makeVertex([x,y,z]);try{if(R.measureDistanceBetween(vertex,s.face)<1e-5)best={kind:'model',bodyId:s.bodyId,point:[x,y,z],normal:s.normal};}finally{vertex.delete();}
   }
   return best;
  },delete(){surfaces.forEach(s=>s.face.delete());}};
 }catch(e){surfaces.forEach(s=>s.face.delete());throw e;}
}
