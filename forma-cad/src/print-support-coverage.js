import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';

export function supportCoverageFace(face,target,settings,override,editable=true){
 const {vertices,triangles}=cadMesh(face);
 if(!triangles.length)return null;
 let point,largest=-1;
 for(let i=0;i<triangles.length;i+=3){
  const [a,b,c]=triangles.slice(i,i+3).map(index=>vertices.slice(index*3,index*3+3));
  const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  if(area<=largest)continue;
  largest=area;point=a.map((value,k)=>(value+b[k]+c[k])/3);
 }
 return {selection:override?.selection||{bodyId:target,point,normal:[0,0,-1]},editable,
  settings:{wallPitch:settings.wallPitch,roofLayers:settings.roofLayers,bottomSkinLayers:settings.bottomSkinLayers},
  override:override?Object.fromEntries(Object.entries(override).filter(([key])=>key!=='selection')):{},
  face:{vertices,triangles},supported:null,caution:null};
}

function blockerCap(blocker,height,layerHeight){
 const vertices=[],triangles=[],faces=blocker.faces,cap=height+layerHeight;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const point=face.center;
   let z;try{z=point.toTuple()[2];}finally{point.delete();}
   if(Math.abs(z-cap)>1e-5)continue;
   const mesh=cadMesh(face);
   if(mesh.vertices.some((value,index)=>index%3===2&&Math.abs(value-cap)>1e-5))continue;
   const start=vertices.length/3;
   for(const [i,value] of mesh.vertices.entries())vertices.push(i%3===2?height:value);
   for(const index of mesh.triangles)triangles.push(index+start);
  }
 }finally{faces.forEach(face=>face.delete());}
 return triangles.length?{vertices,triangles}:null;
}

function edgeMesh(mesh,faceBounds,ribBounds,tolerance){
 if(!mesh||!ribBounds)return null;
 const planes=[];
 for(const axis of [0,1]){
  if(ribBounds[0][axis]-faceBounds[0][axis]>tolerance)planes.push({axis,at:ribBounds[0][axis],side:-1});
  if(faceBounds[1][axis]-ribBounds[1][axis]>tolerance)planes.push({axis,at:ribBounds[1][axis],side:1});
 }
 if(!planes.length)return null;
 const vertices=[],triangles=[];
 for(let i=0;i<mesh.triangles.length;i+=3){
  const points=mesh.triangles.slice(i,i+3).map(j=>mesh.vertices.slice(j*3,j*3+3));
  for(const {axis,at,side} of planes){
   const polygon=[];
   for(let j=0;j<3;j++){
    const a=points[j],b=points[(j+1)%3],da=side*(a[axis]-at),db=side*(b[axis]-at);
    if(da>=0)polygon.push(a);
    if((da>0&&db<0)||(da<0&&db>0))polygon.push(a.map((value,k)=>value+(b[k]-value)*da/(da-db)));
   }
   if(polygon.length<3)continue;
   const start=vertices.length/3;
   for(const point of polygon)vertices.push(...point);
   for(let j=1;j<polygon.length-1;j++)triangles.push(start,start+j,start+j+1);
  }
 }
 return triangles.length?{vertices,triangles}:null;
}

export function supportCoverageRegions(rows,blockers,trimmed,settings){
 return rows.map(({item,index,height,faceBounds,ribBounds})=>{
  const blocker=blockers[index];
  if(blocker&&R.measureVolume(blocker)>.001)item.supported=trimmed.has(index)?blockerCap(blocker,height,settings.layerHeight):true;
  item.caution=edgeMesh(item.supported===true?item.face:item.supported,faceBounds,ribBounds,Math.max(1,2*settings.lineWidth));
  return item;
 });
}
