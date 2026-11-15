import * as R from 'replicad';
import {Vector3} from 'three';
import {MODEL_PRECISION} from './model-precision.js';
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};
const boxDistance=(a,b)=>Math.hypot(...[0,1,2].map(i=>Math.max(0,a[0][i]-b[1][i],b[0][i]-a[1][i])));
function closest(a,b){
 const query=new (R.getOC().BRepExtrema_DistShapeShape)();
 try{query.LoadS1(a.wrapped);query.LoadS2(b.wrapped);query.Perform();if(!query.IsDone())throw Error('最短距離を計算できません');const distance=query.Value();let points=null;if(query.NbSolution()>0){const p=query.PointOnShape1(1),q=query.PointOnShape2(1);try{points=[[p.X(),p.Y(),p.Z()],[q.X(),q.Y(),q.Z()]];}finally{p.delete();q.delete();}}return {distance,points};}finally{query.delete();}
}

// A touching pin can hide a gap between two mounting faces in the body
// minimum. Measure overlapping, opposing planar patches in the selected pair.
function planarClearances(a,b,gapLimit){
 const facesA=a.faces,facesB=b.faces,started=performance.now(),results=[];
 const tuple=v=>{try{return new Vector3(...v.toTuple());}finally{v.delete();}};
 let partial=false,attempts=0;
 try{
  function records(faces){
   const planar=faces.filter(face=>face.geomType==='PLANE');partial||=planar.length>240;
   return planar.slice(0,240).map(face=>({face,normal:tuple(face.normalAt()).normalize(),center:tuple(face.center),box:bounds(face)}));
  }
  const first=records(facesA),second=records(facesB),candidates=[];
  for(const x of first)for(const y of second){
   if(x.normal.dot(y.normal)>-1+1e-8||boxDistance(x.box,y.box)>gapLimit+MODEL_PRECISION.contact)continue;
   const distance=y.center.clone().sub(x.center).dot(x.normal);
   if(distance>MODEL_PRECISION.contact&&distance<=gapLimit+MODEL_PRECISION.contact)candidates.push({x,y,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  for(const {x,y,distance} of candidates){
   if(attempts++>=72||results.length>=12||performance.now()-started>2500){partial=true;break;}
   const delta=x.normal.clone().multiplyScalar(distance);
   let translated,builder,common;
   try{
    translated=x.face.clone().translate(delta.toArray());
    builder=new (R.getOC().BRepAlgoAPI_Common)(translated.wrapped,y.face.wrapped);
    builder.SetNonDestructive(true);builder.Build();
    if(!builder.IsDone()){partial=true;continue;}
    const raw=builder.Shape();if(raw.IsNull()){raw.delete();continue;}
    common=R.cast(raw);
    const area=R.measureArea(common);if(!(area>1e-6))continue;
    const mesh=common.mesh({tolerance:.05,angularTolerance:.15});
    for(let i=0;i<Math.min(mesh.triangles.length,60);i+=3){
     const end=new Vector3();
     for(let j=0;j<3;j++)end.add(new Vector3().fromArray(mesh.vertices,mesh.triangles[i+j]*3));
     end.multiplyScalar(1/3);
     const start=end.clone().sub(delta),midpoint=R.makeVertex(end.clone().addScaledVector(delta,-.5).toArray());
     let exposed;
     try{exposed=R.measureDistanceBetween(midpoint,a)>MODEL_PRECISION.contact&&R.measureDistanceBetween(midpoint,b)>MODEL_PRECISION.contact;}
     finally{midpoint.delete();}
     if(!exposed)continue;
     results.push({distance,area,points:[start.toArray(),end.toArray()]});break;
    }
   }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;partial=true;}
   finally{common?.delete();builder?.delete();translated?.delete();}
  }
  return {rows:results,partial};
 }finally{[...facesA,...facesB].forEach(face=>face.delete());}
}
function measurePair(pair,boxes,{preview=false,exactCommon=false}={}){
 const a=boxes.get(pair.source),b=boxes.get(pair.target);
 const overlap=[0,1,2].every(i=>Math.min(a[1][i],b[1][i])-Math.max(a[0][i],b[0][i])>MODEL_PRECISION.topology);
 let common,volume=0,hit,highlight;
 try{
  if(exactCommon&&overlap)common=pair.a.intersect(pair.b);
  if(common)volume=Math.abs(R.measureVolume(common));
  if(volume<=MODEL_PRECISION.minVolume)hit=closest(pair.a,pair.b);
  if(!exactCommon&&hit?.distance<=MODEL_PRECISION.contact&&overlap){
   common=pair.a.intersect(pair.b);volume=Math.abs(R.measureVolume(common));
  }
  if(!Number.isFinite(volume)||hit&&!Number.isFinite(hit.distance))throw Error('距離または共通部分を検査できません');
  const interference=volume>MODEL_PRECISION.minVolume,distance=hit?.distance??0;
  const status=interference?'interference':distance<=MODEL_PRECISION.contact?'contact':'gap';
  const row={source:pair.source,target:pair.target,status,distance,volume,points:hit?.points??null};
  if(exactCommon&&interference)row.bounds=bounds(common);
  if(preview&&interference&&common){
   try{
    const mesh=common.mesh({tolerance:.04,angularTolerance:.15});
    if(mesh.triangles.length&&mesh.triangles.length<=120000)highlight={source:pair.source,target:pair.target,...mesh};
   }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
  }
  return {row,highlight};
 }finally{common?.delete();}
}
// Check the whole moving rigid group against all stationary bodies. AABB lower
// bounds only prune pairs that cannot overlap or improve the known minimum gap.
export function inspectAssemblyContact(moving,stationary,{preview=false,maxPairs=128,maxMs=2000,onProgress}={}){
 const boxes=new Map([...moving,...stationary].map(([id,shape])=>[id,bounds(shape)])),pairs=[];
 for(const [source,a]of moving)for(const [target,b]of stationary)pairs.push({source,target,a,b,lower:boxDistance(boxes.get(source),boxes.get(target))});pairs.sort((a,b)=>a.lower-b.lower);
 const rows=[],highlights=[],started=performance.now();let nearest=Infinity,checked=0,pruned=0,errors=0;
 for(const pair of pairs){
  if(pair.lower>nearest+MODEL_PRECISION.contact){pruned++;continue;}
  if(checked>=maxPairs||performance.now()-started>maxMs)break;
  onProgress?.({stage:'部品の接触を検査しています（'+(checked+1)+'組目）'});checked++;
  try{
   const {row,highlight}=measurePair(pair,boxes,{preview:preview&&highlights.length<24});
   nearest=Math.min(nearest,row.distance);rows.push(row);
   if(highlight)highlights.push(highlight);
  }catch(error){errors++;rows.push({source:pair.source,target:pair.target,status:'unknown',message:'この組合せを検査できませんでした'});}
 }
 const complete=checked+pruned===pairs.length&&errors===0,interference=rows.filter(r=>r.status==='interference'),near=rows.filter(r=>Number.isFinite(r.distance)).sort((a,b)=>a.distance-b.distance)[0];
 return {report:{status:interference.length?'interference':!complete?'unknown':near?.status||'none',complete,checked,pruned,total:pairs.length,rows,nearest:near?{source:near.source,target:near.target,distance:near.distance}:null},highlights};
}

// Audit each unordered pair once. Lower bounds rule out distant pairs
// before running native intersections and distance queries.
export function inspectAssemblyClearances(ids,shapes,{gapLimit=2,against=[],preview=false,maxPairs=800,maxMs=12000,onProgress}={}){
 const boxes=new Map(),pairs=[],rows=[],opposite=new Set(against),started=performance.now();
 for(const id of ids){
  const shape=shapes.get(id);if(!shape)continue;
  try{boxes.set(id,bounds(shape));}catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
 }
 let total=0,pruned=0,checked=0,errors=0,unavailable=0,highlight,faceGaps;
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const source=ids[i],target=ids[j];
  if(opposite.size&&opposite.has(source)===opposite.has(target))continue;
  total++;
  if(!boxes.has(source)||!boxes.has(target)){unavailable++;continue;}
  const lower=boxDistance(boxes.get(source),boxes.get(target));
  if(lower>gapLimit+MODEL_PRECISION.contact){pruned++;continue;}
  pairs.push({source,target,a:shapes.get(source),b:shapes.get(target),lower});
 }
 pairs.sort((a,b)=>a.lower-b.lower);
 const farFromReport=row=>row.status==='gap'&&row.distance>gapLimit+MODEL_PRECISION.contact;
 let outside=0;
 for(const pair of pairs){
  if(checked>=maxPairs||performance.now()-started>maxMs)break;
  if(checked%5===0)onProgress?.({stage:'干渉・隙間を検査しています',current:checked+1,total:pairs.length});
  checked++;
  try{
   const result=measurePair(pair,boxes,{exactCommon:true,preview});
   if(farFromReport(result.row))outside++;else rows.push(result.row);
   if(result.highlight)highlight=result.highlight;
   if(preview&&gapLimit>MODEL_PRECISION.contact){
    try{faceGaps=planarClearances(pair.a,pair.b,gapLimit);}
    catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;faceGaps={rows:[],partial:true};}
   }
  }catch(error){
   if(error instanceof WebAssembly.RuntimeError)throw error;
   errors++;rows.push({source:pair.source,target:pair.target,status:'unknown'});
  }
 }
 const untested=pairs.length-checked;
 return {total,checked,pruned,outside,unavailable,unavailableIds:ids.filter(id=>!boxes.has(id)),untested,errors,complete:!untested&&!unavailable&&!errors,rows,highlight,faceGaps};
}
