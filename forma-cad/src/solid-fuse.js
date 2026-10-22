import {MODEL_PRECISION,BOOLEAN_TOLERANCES} from './model-precision.js';
import * as R from 'replicad';
import {measurePhase} from './phase-timings.js';
import {solidMeshComplete} from './solid-mesh.js';

// Offset/cut results can wrap one oriented solid in a compound. OCCT's fuse
// classifies that wrapper differently and can omit the entire input body.
// Use its actual solid while retaining the source and its shared native data.
function singleSolidInput(shape){
 if(shape instanceof R.Solid)return shape;
 const solids=shape.solids;
 try{return solids.length===1?solids[0].clone():shape;}
 finally{solids.forEach(solid=>solid.delete());}
}

// Build one boolean operation for all inputs. Repeated pairwise fuses re-split
// an ever larger result and retain native intermediate shapes until deleted.
export function fuseSolids(shapes,{onProgress,verifyMesh=false}={}){
 const inputs=[];try{for(const shape of shapes)inputs.push(singleSolidInput(shape));return fuseBatch(inputs,{onProgress,verifyMesh});}
 finally{inputs.forEach((shape,i)=>{if(shape!==shapes[i])shape.delete();});}
}
// Fuzzy retries may not merge solids that the common contact test considers
// separated. Partition only when the exact boolean still has multiple solids.
function contactGroups(shapes){
 const parts=shapes.flatMap(s=>s.solids);
 if(parts.length>512){parts.forEach(p=>p.delete());return null;}
 try{
  const boxes=parts.map(s=>{const b=s.boundingBox;try{return b.bounds.map(p=>[...p]);}finally{b.delete();}}),parents=parts.map((_,i)=>i),root=i=>{while(parents[i]!==i)i=parents[i];return i;};
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){if(root(i)===root(j)||boxes[i][0].some((v,k)=>v>boxes[j][1][k]+MODEL_PRECISION.contact||boxes[i][1][k]<boxes[j][0][k]-MODEL_PRECISION.contact))continue;if(R.measureDistanceBetween(parts[i],parts[j])<=MODEL_PRECISION.contact)parents[root(j)]=root(i);}
  const groups=new Map();parts.forEach((p,i)=>{const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});return [...groups.values()];
 }catch(error){parts.forEach(p=>p.delete());throw error;}
}
function fuseBatch(shapes,{onProgress,verifyMesh=false}={}){
 if(!shapes.length)throw Error('結合するボディを選択してください');
 if(shapes.length===1)return shapes[0].clone();
 const oc=R.getOC(),volumes=shapes.map(shape=>Math.abs(R.measureVolume(shape))),sum=volumes.reduce((a,b)=>a+b,0),largest=Math.max(...volumes),eps=Math.max(MODEL_PRECISION.minVolume,sum*MODEL_PRECISION.relativeVolume)+MODEL_PRECISION.contact*shapes.reduce((n,s)=>n+R.measureArea(s),0);
 let best=null,bestCount=Infinity;
 const snapshots=verifyMesh?shapes.map(s=>s.serialize()):null;
 try{
 for(const tolerance of BOOLEAN_TOLERANCES){
  if(tolerance){const groups=contactGroups(shapes);if(!groups)break;try{if(groups.length>1){const pieces=[];try{for(const group of groups)pieces.push(fuseBatch(group,{onProgress,verifyMesh}));return R.makeCompound(pieces);}finally{pieces.forEach(p=>p.delete());}}}finally{groups.flat().forEach(p=>p.delete());}}
  const inputs=snapshots?snapshots.map(b=>R.deserializeShape(b).asShape3D()):shapes;const builder=new oc.BRepAlgoAPI_Fuse(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),toolsList=new oc.NCollection_List_TopoDS_Shape();let result=null;
  try{
   argumentsList.Append(inputs[0].wrapped);for(const shape of inputs.slice(1))toolsList.Append(shape.wrapped);
   builder.SetArguments(argumentsList);builder.SetTools(toolsList);builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);
   onProgress?.({stage:shapes.length+'個のボディをまとめて結合しています'+(tolerance?'（境界を再確認）':'')});
   builder.Build();if(builder.HasErrors())continue;result=R.cast(builder.Shape()).asShape3D();
   onProgress?.({stage:'結合したソリッドを検査しています'});
   const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);let valid;
   try{const volume=R.measureVolume(result);valid=check.IsValid()&&Number.isFinite(volume)&&volume>=largest-eps&&volume<=sum+eps&&(!verifyMesh||solidMeshComplete(result));}finally{check.delete();}
   if(valid){const parts=result.solids;let count;try{count=parts.length;}finally{parts.forEach(part=>part.delete());}if(count<bestCount){best?.delete();best=result;bestCount=count;result=null;}if(count===1){const output=best;best=null;return output;}}
  }catch{}finally{result?.delete();builder.delete();argumentsList.delete();toolsList.delete();if(snapshots)inputs.forEach(s=>s.delete());}
 }
 if(best){const output=best;best=null;return output;}
 throw Error('正常なソリッドとして結合できませんでした。元のボディは変更していません');
 }finally{best?.delete();}
}
// Pair and multi-body joins share exactly the same bounded contact policy.
export function fuseSolid(base,tool,options={}){return measurePhase('geometry',()=>fuseSolids([base,tool],options));}
