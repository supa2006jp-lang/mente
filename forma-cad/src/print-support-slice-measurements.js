import {closestSupportPaths,indexSupportPath,pointOnSupportPath,supportLayerHasPath,supportPathCells,
 supportSliceBounds,supportSliceCadPoint,supportSlicePoint} from './print-support-slice-geometry.js';

const round=value=>Number(value.toFixed(4));
const pathBox=path=>[Math.min(path.ax,path.bx),Math.min(path.ay,path.by),Math.max(path.ax,path.bx),Math.max(path.ay,path.by)];
const partAt=(parts,point)=>parts.find(part=>part.contains(...point));
const activeAt=(part,z)=>z>=part.bounds[0][2]-1e-6&&z<=part.bounds[1][2]+1e-6;
const nearBox=(point,box,margin)=>[0,1].every(i=>point[i]>=box[0][i]-margin&&point[i]<=box[1][i]+margin);

function lateralSample(a,b,pair,matrix,z){
 const halfA=a.width/2,halfB=b.width/2,gap=pair.distance-halfA-halfB;
 let from=pair.a,to=pair.b;
 if(gap>0){
  const d=[(pair.b[0]-pair.a[0])/pair.distance,(pair.b[1]-pair.a[1])/pair.distance];
  from=[pair.a[0]+d[0]*halfA,pair.a[1]+d[1]*halfA];
  to=[pair.b[0]-d[0]*halfB,pair.b[1]-d[1]*halfB];
 }
 return {gap:round(gap),from:supportSliceCadPoint(matrix,[...from,z]),to:supportSliceCadPoint(matrix,[...to,z]),
  widthKnown:a.widthKnown&&b.widthKnown};
}

export function measureSupportLateralGaps({layers,matrix,sources,models},onProgress){
 const targets=sources.filter(source=>Number.isFinite(source.sideGap)).map(source=>({
  target:source.target,requested:source.sideGap,solid:source.solid,layers:[],radius:Math.max(2,source.sideGap+1),
 }));
 const targetBySolid=new Map(targets.map(target=>[target.solid,target]));
 if(!targets.length)return [];
 for(const [index,layer] of layers.entries()){
  if(!layer.paths.length)continue;
  const z=layer.mid-matrix[11],realModels=models.filter(model=>activeAt(model,z));
  const active=targets.filter(target=>activeAt(target.solid,z));
  if(!realModels.length||!active.length)continue;
  if(index%120===0)onProgress?.({stage:'同じ層の側壁とリブの横すき間を調べています'});
  const supports=active.map(target=>target.solid),nearModels=new Map(),ribPaths=[];
  for(const path of layer.paths){
   if(!path.normal)continue;
   const count=Math.max(1,Math.ceil(Math.hypot(path.bx-path.ax,path.by-path.ay)/4));
   for(let i=0;i<count;i++){
    const [x,y]=pointOnSupportPath(path,(i+.5)/count);
    const point=supportSliceCadPoint(matrix,[x,y,layer.mid]);
    if(!active.some(target=>nearBox(point,target.solid.bounds,target.radius+5)))continue;
    const model=partAt(realModels,point),support=partAt(supports,point);
    if(!!model===!!support)continue;
    const [ax,ay]=pointOnSupportPath(path,i/count),[bx,by]=pointOnSupportPath(path,(i+1)/count);
    const chunk={ax,ay,bx,by,width:path.width,widthKnown:path.widthKnown,owner:model||support};
    if(model)indexSupportPath(nearModels,chunk);
    else ribPaths.push(chunk);
   }
  }
  const groups=new Map();
  for(const rib of ribPaths){
   const target=targetBySolid.get(rib.owner),[x0,y0,x1,y1]=pathBox(rib);
   let nearest=null;
   const visited=new Set();
   for(const bucket of supportPathCells(nearModels,x0,y0,x1,y1,target.radius+3)){
    for(const side of bucket){
     if(visited.has(side))continue;
     visited.add(side);
     const [bx0,by0,bx1,by1]=pathBox(side),reach=target.radius+(rib.width+side.width)/2;
     if(bx1<x0-reach||bx0>x1+reach||by1<y0-reach||by0>y1+reach)continue;
     const pair=closestSupportPaths(rib,side),gap=pair.distance-(rib.width+side.width)/2;
     if(gap>target.radius||nearest&&gap>=nearest.gap)continue;
     if(!rib.owner.contains(...supportSliceCadPoint(matrix,[...pair.a,layer.mid]))||
      !side.owner.contains(...supportSliceCadPoint(matrix,[...pair.b,layer.mid])))continue;
     nearest={gap,sample:lateralSample(rib,side,pair,matrix,layer.z)};
    }
   }
   if(!nearest)continue;
   if(!groups.has(target))groups.set(target,new Map());
   const samples=groups.get(target),[x,y]=nearest.sample.from,cell=Math.floor(x/3)+','+Math.floor(y/3);
   if(!samples.has(cell)||samples.get(cell).gap>nearest.gap)samples.set(cell,nearest.sample);
  }
  for(const [target,group] of groups){
   const samples=[...group.values()].sort((a,b)=>a.gap-b.gap);
   target.layers.push({index:index+1,z:round(layer.z-matrix[11]),minimum:samples[0].gap,count:samples.length,samples:samples.slice(0,16)});
  }
 }
 return targets.map(({target,requested,layers})=>({target,requested,layers}));
}

const cross=(x,y,dx,dy)=>x*dy-y*dx;
function clipTriangle(start,end,triangle){
 let lo=0,hi=1;
 const sign=triangle.sign;
 for(const [i,a] of triangle.points.entries()){
  const b=triangle.points[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1];
  const s=sign*cross(dx,dy,start[0]-a[0],start[1]-a[1]),t=sign*cross(dx,dy,end[0]-a[0],end[1]-a[1]);
  if(s< -1e-7&&t< -1e-7)return null;
  if(s< -1e-7)lo=Math.max(lo,s/(s-t));
  if(t< -1e-7)hi=Math.min(hi,s/(s-t));
  if(lo>=hi)return null;
 }
 return [lo,hi];
}

function ceilingTriangles(face){
 const triangles=[];
 for(let i=0;i<face.triangles.length;i+=3){
  const points=face.triangles.slice(i,i+3).map(index=>face.vertices.slice(index*3,index*3+2));
  const [a,b,c]=points,area=cross(b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1]);
  if(Math.abs(area)<1e-9)continue;
  const x=points.map(p=>p[0]),y=points.map(p=>p[1]);
  triangles.push({points,sign:Math.sign(area),box:[Math.min(...x),Math.min(...y),Math.max(...x),Math.max(...y)]});
 }
 return triangles;
}

function ceilingSpans(path,triangles,matrix,z){
 const a=supportSliceCadPoint(matrix,[path.ax,path.ay,z]),b=supportSliceCadPoint(matrix,[path.bx,path.by,z]);
 const [left,bottom,right,top]=pathBox({ax:a[0],ay:a[1],bx:b[0],by:b[1]});
 const ranges=[];
 for(const triangle of triangles){
  const [x0,y0,x1,y1]=triangle.box;
  if(x1<left||x0>right||y1<bottom||y0>top)continue;
  const span=clipTriangle(a,b,triangle);
  if(span)ranges.push(span);
 }
 ranges.sort((a,b)=>a[0]-b[0]);
 const merged=[];
 for(const span of ranges){
  const previous=merged.at(-1);
  if(previous&&previous[1]>=span[0]-1e-7)previous[1]=Math.max(previous[1],span[1]);
  else merged.push(span);
 }
 return merged;
}

function supportBelow(layers,index,x,y,context){
 const {matrix,source,models,height}=context,first=layers[index],shift=matrix[11];
 const plane=Math.max(height,first.z-first.height-shift);
 const lowest=plane-source.topGap-Math.max(first.height,.06)-.015;
 for(let i=index-1;i>=0&&layers[i].z-shift>=lowest;i--){
  const layer=layers[i],z=layer.mid;
  const isAt=(part,px,py)=>part.contains(...supportSliceCadPoint(matrix,[px,py,z]));
  if(supportLayerHasPath(layer,x,y,(path,px,py)=>path.normal&&isAt(source.solid,px,py)))return 'rib';
  if(supportLayerHasPath(layer,x,y,path=>!path.normal))return 'auto';
  if(supportLayerHasPath(layer,x,y,(path,px,py)=>path.normal&&models.some(model=>isAt(model,px,py))))return 'model';
 }
 return 'open';
}

function measureCeilingLayer(context,index,triangles){
 const {matrix,layers,source}=context,layer=layers[index],paths={rib:[],auto:[],model:[],open:[]};
 const lengths={rib:0,auto:0,model:0,open:0};
 let last=null,continuous=0,longest=0,total=0,limited=false;
 function add(role,a,b,length,path){
  const contiguous=last&&Math.hypot(a[0]-last.x,a[1]-last.y)<.002&&last.role===role;
  continuous=contiguous?continuous+length:length;
  if(role==='open')longest=Math.max(longest,continuous);
  const points=paths[role];
  const merged=contiguous&&last.path===path&&last.saved,drawn=points.length<72000;
  if(merged)points.splice(points.length-3,3,...supportSliceCadPoint(matrix,[...b,layer.z]));
  else if(drawn)points.push(...supportSliceCadPoint(matrix,[...a,layer.z]),...supportSliceCadPoint(matrix,[...b,layer.z]));
  else limited=true;
  last={x:b[0],y:b[1],role,path,saved:merged||drawn};
  lengths[role]+=length;total+=length;
 }
 for(const path of layer.paths){
  if(!path.normal)continue;
  const distance=Math.hypot(path.bx-path.ax,path.by-path.ay);
  for(const [lo,hi] of ceilingSpans(path,triangles,matrix,layer.mid)){
   const count=Math.max(1,Math.ceil(distance*(hi-lo)/.3));
   for(let i=0;i<count;i++){
    const a=lo+(hi-lo)*i/count,b=lo+(hi-lo)*(i+1)/count;
    const [x,y]=pointOnSupportPath(path,(a+b)/2),point=supportSliceCadPoint(matrix,[x,y,layer.mid]);
    if(!source.model.contains(...point)){last=null;continue;}
    add(supportBelow(layers,index,x,y,context),pointOnSupportPath(path,a),pointOnSupportPath(path,b),distance*(b-a),path);
   }
  }
 }
 if(total<.01)return null;
 return {index:index+1,z:round(layer.z-matrix[11]),total:round(total),longest:round(longest),limited,
  lengths:Object.fromEntries(Object.entries(lengths).map(([key,value])=>[key,round(value)])),paths};
}

export function measureSupportCeilings({layers,matrix,sources,models,searchLayer},onProgress){
 const result=[],shift=matrix[11];
 for(const source of sources){
  if(!source.model)continue;
  for(const {id,number,face} of source.ceilings||[]){
   const [low,high]=supportSliceBounds(face.vertices);
   if(high[2]-low[2]>1e-4||!Number.isFinite(low[2]))continue;
   const height=low[2],triangles=ceilingTriangles(face);
   if(!triangles.length)continue;
   onProgress?.({stage:'天井を刷り始める層と下の支えを照合しています'});
   const start=searchLayer(layers,height+shift-.001);
   let measured=null;
   for(let i=start;i<layers.length&&layers[i].mid<=height+shift+Math.max(layers[i].height,.12)+.015;i++){
    measured=measureCeilingLayer({matrix,layers,source,models,height},i,triangles);
    if(measured)break;
   }
   result.push({target:source.target,id,number,height:round(height),measured});
  }
 }
 return result;
}
