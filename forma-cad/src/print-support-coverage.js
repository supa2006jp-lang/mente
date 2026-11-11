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

export function supportHorizontalCap(shape,cap,height=cap){
 const vertices=[],triangles=[],faces=shape.faces;
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

export function supportBoundaryPaths(mesh){
 const points=[],vertices=new Map(),edges=new Map();
 const vertex=index=>{
  const point=mesh.vertices.slice(3*index,3*index+3),key=point.map(v=>Math.round(v*1e6)).join(',');
  if(!vertices.has(key)){vertices.set(key,points.length);points.push(point);}
  return vertices.get(key);
 };
 for(let i=0;i<mesh.triangles.length;i+=3){
  const triangle=mesh.triangles.slice(i,i+3).map(vertex);
  for(const [j,a] of triangle.entries()){
   const b=triangle[(j+1)%3];if(a===b)continue;
   const key=a<b?a+':'+b:b+':'+a;
   if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
  }
 }
 const links=new Map();
 for(const edge of edges.values())if(edge.count===1)for(const index of [edge.a,edge.b]){
  if(!links.has(index))links.set(index,[]);
  links.get(index).push(edge);
 }
 const paths=[];
 for(const edge of edges.values())if(edge.count===1&&!edge.used){
  const path=[points[edge.a]];
  let next=edge,at=edge.a;
  while(next){
   next.used=true;at=next.a===at?next.b:next.a;path.push(points[at]);
   next=links.get(at).find(item=>!item.used);
  }
  paths.push(path);
 }
 return paths;
}

function coverageTriangles(mesh){
 const triangles=[];
 for(let i=0;i<mesh.triangles.length;i+=3){
  const points=mesh.triangles.slice(i,i+3).map(index=>mesh.vertices.slice(index*3,index*3+2));
  const [a,b,c]=points;
  if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-12)continue;
  const x=points.map(p=>p[0]),y=points.map(p=>p[1]);
  triangles.push({points,left:Math.min(...x),right:Math.max(...x),bottom:Math.min(...y),top:Math.max(...y)});
 }
 return triangles;
}

function distanceToTriangles(point,triangles,maxDistance=Infinity){
 const [x,y]=point;
 let nearest=maxDistance**2;
 for(const {points,left,right,bottom,top} of triangles){
  if(Math.max(0,left-x,x-right)**2+Math.max(0,bottom-y,y-top)**2>=nearest)continue;
  let positive=false,negative=false;
  for(const [i,a] of points.entries()){
   const b=points[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],px=x-a[0],py=y-a[1],cross=dx*py-dy*px;
   positive||=cross>1e-9;negative||=cross< -1e-9;
   const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));
   nearest=Math.min(nearest,(px-t*dx)**2+(py-t*dy)**2);
  }
  if(!positive||!negative)return 0;
 }
 return Math.sqrt(nearest);
}

export function supportBoundaryWarnings(face,landingMeshes,supported,tolerance){
 const paths=supportBoundaryPaths(face),landings=landingMeshes.flatMap(coverageTriangles);
 if(!landings.length)return [];
 const covered=supported===true?null:coverageTriangles(supported);
 const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const perimeter=paths.reduce((total,path)=>total+path.slice(1).reduce((sum,b,i)=>sum+length(path[i],b),0),0);
 const step=Math.max(.5,perimeter/1600),warnings=[];
 for(const path of paths){
  const runs=[];
  let run=null,starts=false,first=true;
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],span=length(a,b),count=Math.ceil(span/step);
   const at=t=>a.map((v,k)=>v+(b[k]-v)*t);
   for(let j=0;j<count;j++){
    const point=at((j+.5)/count);
    const gap=covered&&distanceToTriangles(point,covered,1)>.002?0:distanceToTriangles(point,landings);
    if(first){starts=gap>tolerance;first=false;}
    if(gap<=tolerance){run=null;continue;}
    if(!run){run={length:0,maxGap:0,segments:[]};runs.push(run);}
    run.length+=span/count;run.maxGap=Math.max(run.maxGap,gap);run.segments.push(...at(j/count),...at((j+1)/count));
   }
  }
  if(starts&&run&&runs.length>1&&length(path[0],path.at(-1))<1e-6){
   const firstRun=runs.shift();run.length+=firstRun.length;run.maxGap=Math.max(run.maxGap,firstRun.maxGap);
   run.segments=run.segments.concat(firstRun.segments);
  }
  warnings.push(...runs);
 }
 return warnings.filter(run=>run.length>=step/2);
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
 return rows.map(({item,index,height,faceBounds,ribBounds,landings=[],checkExcludedEdge=false})=>{
  const blocker=blockers[index];
  if(checkExcludedEdge)item.showBoundaryWarnings=true;
  if(blocker&&R.measureVolume(blocker)>.001)item.supported=trimmed.has(index)?supportHorizontalCap(blocker,height+settings.layerHeight,height):true;
  const tolerance=Math.max(1,2*settings.lineWidth);
  item.caution=edgeMesh(item.supported===true?item.face:item.supported,faceBounds,ribBounds,tolerance);
  if(landings.length&&(item.supported||checkExcludedEdge))
   item.boundaryWarnings=supportBoundaryWarnings(item.face,landings,checkExcludedEdge?true:item.supported,tolerance);
  return item;
 });
}
