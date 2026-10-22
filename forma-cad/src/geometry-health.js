import * as R from 'replicad';
import {MODEL_PRECISION as P,microLength,volumeAllowance,isContactDistance} from './model-precision.js';

const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}};
const center=b=>b[0].map((v,i)=>(v+b[1][i])/2);
const gapBounds=(a,b)=>Math.hypot(...a[0].map((v,i)=>Math.max(0,v-b[1][i],b[0][i]-a[1][i])));
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function healthBudget(detailed=false){return {deadline:Date.now()+(detailed?2500:60),faces:detailed?3000:100,edges:detailed?6000:200,queries:detailed?180:16,partial:false};}
function available(budget,key){if(Date.now()>budget.deadline||budget[key]<=0){budget.partial=true;return false;}budget[key]--;return true;}

// Findings are observations, never a reason to delete a small intentional part.
export function inspectShapeHealth(shape,{id,before=null,bodies=new Map(),spec={},threshold,budget=healthBudget(),detailed=false}={}){
 const box=bounds(shape),diagonal=Math.hypot(...box[0].map((v,i)=>box[1][i]-v)),limit=threshold??microLength(diagonal),volume=Math.abs(R.measureVolume(shape)),parts=shape.solids,findings=[],planes=[];
 let faces=[],edges=[],beforeParts=[],beforeVolume=null;
 const add=(code,detail={})=>{if(findings.length<40)findings.push({code,bodyId:id,...detail});else budget.partial=true;};
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,detailed,false);let valid;try{valid=check.IsValid();}finally{check.delete();}
 try{
  if(before){beforeVolume=Math.abs(R.measureVolume(before));beforeParts=before.solids;}
  if(!valid)add('invalid-solid',{severity:'error',bounds:box});
  if(parts.length>1&&(detailed||spec.type==='join'||parts.length>(before?beforeParts.length:1)))add('disconnected',{count:parts.length,bounds:box});
  if(before&&spec.type==='move'&&Math.abs(volume-beforeVolume)>volumeAllowance(beforeVolume))add('unexpected-volume',{before:beforeVolume,after:volume,severity:'error',bounds:box});
  const preserved=before&&['move','mirror'].includes(spec.type)&&Math.abs(volume-beforeVolume)<=volumeAllowance(beforeVolume)&&parts.length===beforeParts.length;
  const sampled=parts.slice(0,200);if(sampled.length<parts.length)budget.partial=true;
  for(const [i,part]of sampled.entries()){
   const b=bounds(part),sizes=b[0].map((v,k)=>b[1][k]-v),smallest=Math.min(...sizes),v=Math.abs(R.measureVolume(part));
   if((!preserved||detailed)&&smallest>P.topology&&(smallest<limit||v<limit**3))add('small-component',{component:i,size:smallest,volume:v,bounds:b});
  }
  // Repeated warnings on an unchanged translated/mirrored part are suppressed.
  faces=shape.faces;edges=shape.edges;
  if(!preserved||detailed){
   for(const [i,edge]of edges.entries()){
    if(!available(budget,'edges'))break;const length=R.measureLength(edge);if(length>P.topology&&length<limit)add('short-edge',{edge:i,size:length,bounds:bounds(edge)});
   }
  }
  for(const [i,face]of faces.entries()){
   if(!available(budget,'faces'))break;
   const area=Math.abs(R.measureArea(face)),boundary=face.edges;let perimeter;
   try{perimeter=boundary.reduce((n,e)=>n+R.measureLength(e),0);}finally{boundary.forEach(e=>e.delete());}
   const width=perimeter>0?2*area/perimeter:0;
   if((!preserved||detailed)&&width>P.topology&&width<limit)add('narrow-face',{face:i,size:width,area,bounds:bounds(face)});
   if(face.geomType==='PLANE'&&planes.length<120)planes.push({face,index:i,normal:tuple(face.normalAt()),bounds:bounds(face)});
   else if(face.geomType==='PLANE')budget.partial=true;
  }
  planePairs: if(!preserved||detailed)for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
   const a=planes[i],b=planes[j];if(a.normal.reduce((n,v,k)=>n+v*b.normal[k],0)>-1+P.angular||gapBounds(a.bounds,b.bounds)>limit)continue;
   if(!available(budget,'queries'))break planePairs;
   const query=new R.DistanceTool();let p,q,vertex;
   try{
    const distance=query.distanceBetween(a.face,b.face);if(isContactDistance(distance)||distance>limit||query.wrapped.NbSolution()<1)continue;
    p=query.wrapped.PointOnShape1(1);q=query.wrapped.PointOnShape2(1);const from=[p.X(),p.Y(),p.Z()],to=[q.X(),q.Y(),q.Z()];
    if(to.reduce((n,v,k)=>n+(v-from[k])*a.normal[k],0)<=P.contact)continue;
    const point=from.map((v,k)=>(v+to[k])/2);vertex=R.makeVertex(point);
    // Distance to a solid is zero for an interior point. This distinguishes a
    // narrow void from a deliberately thin wall between two outward faces.
    if(R.measureDistanceBetween(vertex,shape)>P.contact)add('micro-gap',{size:distance,faces:[a.index,b.index],point,bounds:[from.map((v,k)=>Math.min(v,to[k])),from.map((v,k)=>Math.max(v,to[k]))]});
   }finally{vertex?.delete();p?.delete();q?.delete();query.delete();}
  }
  for(const [otherId,other]of bodies){
   if(otherId===id||other===shape)continue;const otherBox=bounds(other);if(gapBounds(box,otherBox)>limit)continue;if(!available(budget,'queries'))break;
   const distance=R.measureDistanceBetween(shape,other);if(!Number.isFinite(distance)||isContactDistance(distance)||distance>limit)continue;
   if(before&&!detailed&&Math.abs(R.measureDistanceBetween(before,other)-distance)<=P.contact)continue;
   add('micro-gap',{otherId,size:distance,bounds:[center(box),center(otherBox)].reduce((b,p)=>[p.map((v,i)=>Math.min(v,b[0][i])),p.map((v,i)=>Math.max(v,b[1][i]))],[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]])});
  }
  // Compounds can contain separated pieces whose overall bounds overlap.
  partPairs: for(let i=0;i<sampled.length;i++)for(let j=i+1;j<sampled.length;j++){
   if(gapBounds(bounds(parts[i]),bounds(parts[j]))>limit)continue;if(!available(budget,'queries'))break partPairs;const distance=R.measureDistanceBetween(parts[i],parts[j]);if(distance>P.contact&&distance<=limit)add('micro-gap',{components:[i,j],size:distance,bounds:box});
  }
  return {id,threshold:limit,valid,before:before?{volume:beforeVolume,solids:beforeParts.length}:null,after:{volume,solids:parts.length,faces:faces.length,edges:edges.length},bounds:box,findings,partial:budget.partial};
 }finally{[...parts,...beforeParts,...faces,...edges].forEach(s=>s.delete());}
}

export function inspectGeometryHealth(bodies,{targets=[...bodies.keys()],threshold}={},onProgress){
 if(!Array.isArray(targets)||targets.length>100||targets.some(id=>!bodies.has(id))||threshold!==undefined&&(!Number.isFinite(threshold)||threshold<1e-6||threshold>1))throw Error('検査するボディと寸法を確認してください');
 const budget=healthBudget(true),rows=[];
 for(const [i,id]of [...new Set(targets)].entries()){onProgress?.({stage:'微小な面・辺・隙間と連結状態を検査しています',current:i+1,total:targets.length});rows.push(inspectShapeHealth(bodies.get(id),{id,bodies,threshold,budget,detailed:true}));}
 const pairs=new Set();for(const row of rows)row.findings=row.findings.filter(f=>{if(f.code!=='micro-gap'||!f.otherId)return true;const key=[row.id,f.otherId].sort().join('\u0000');if(pairs.has(key))return false;pairs.add(key);return true;});
 return {version:P.version,rows,partial:budget.partial,findings:rows.reduce((n,r)=>n+r.findings.length,0)};
}

export function diagnoseOutputHealth(bodies,result,spec){
 const budget=healthBudget(),rows=[];
 for(const output of result.outputs||[]){if(!output.brep)continue;const shape=R.deserializeShape(output.brep).asShape3D();try{const row=inspectShapeHealth(shape,{id:output.id,before:bodies.get(output.id),bodies,spec,budget});if(!row.valid)throw Error('加工結果のソリッドに異常があります。元の形状は変更していません');rows.push(row);}finally{shape.delete();}}
 if(rows.length)result.analysis={...result.analysis,geometryHealth:{version:P.version,rows}};return result;
}
