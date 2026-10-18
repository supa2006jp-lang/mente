import * as R from 'replicad';
import {patternCavities} from './pattern-cavities.js';
import {patternTransforms} from './patterns.js';
export const hybridPattern=p=>p.type==='circular'&&['新規かつ切り取り','切り取りのみ'].includes(p.operation);
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}},overlap=(a,b)=>a[0].every((lo,i)=>lo<=b[1][i]+1e-6&&a[1][i]>=b[0][i]-1e-6);
function cutBatch(base,tools){
 const box=bounds(base),nearby=tools.filter(tool=>overlap(box,tool.bounds));if(!nearby.length)return base.clone();
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Cut(),args=new oc.NCollection_List_TopoDS_Shape(),cuts=new oc.NCollection_List_TopoDS_Shape();let result;
 try{
  args.Append(base.wrapped);nearby.forEach(tool=>cuts.Append(tool.shape.wrapped));builder.SetArguments(args);builder.SetTools(cuts);builder.SetNonDestructive(true);builder.Build();
  if(builder.HasErrors())throw Error('切り取り計算に失敗しました');result=R.cast(builder.Shape()).asShape3D();const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);
  try{if(!check.IsValid()||!Number.isFinite(R.measureVolume(result))||R.measureVolume(result)< -1e-7)throw Error('切り取り後の形状が不正です');}finally{check.delete();}
  const output=result;result=null;return output;
 }finally{result?.delete();builder.delete();args.delete();cuts.delete();}
}
export function hybridCircularPattern(base,p,axis,bodies,emit,remove,onProgress){
 patternTransforms(p);const center=p.origin||[0,0,0],rotationAxis=p.axisVector||axis;if(![center,rotationAxis].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||Math.hypot(...rotationAxis)<1e-8)throw Error('回転中心と回転軸を指定してください');
 const copies=[],holes=[],created=[],cutBodies=[],newBodies=[],skipped=[];let emitted=0,sourceHoles=0;
 const output=(id,shape)=>{if(++emitted>100)throw Error('一度に作成するボディは100個以内にしてください');emit(id,shape);};
 try{
  if(p.operation==='切り取りのみ')return cutOnlyCircularPattern(base,p,center,rotationAxis,bodies,output,remove,onProgress);
  for(let i=1;i<p.count;i++){const shape=base.clone().rotate(p.angle*i/p.count,center,rotationAxis);copies.push({position:i,shape,bounds:bounds(shape)});}
  if(!copies.length)return {patternHybrid:{sourceHoles:0,cutBodies,newBodies,skippedPositions:skipped}};
  if(p.targets&&(!Array.isArray(p.targets)||p.targets.some(id=>typeof id!=='string'||!bodies.has(id))))throw Error('パターンの対象ボディが見つかりません');const targets=p.targets?new Set(p.targets):null;
  const candidates=[...bodies].filter(([id])=>!targets||targets.has(id)||id===p.target).map(([id,shape])=>({id,shape,bounds:bounds(shape)})).filter(body=>body.id===p.target||copies.some(copy=>overlap(body.bounds,copy.bounds)));
  const source=patternCavities(base,onProgress);sourceHoles=source.length;for(const shape of source){holes.push({shape,bounds:bounds(shape)});for(let i=1;i<p.count;i++){const copy=shape.clone().rotate(p.angle*i/p.count,center,rotationAxis);holes.push({shape:copy,bounds:bounds(copy)});}}
  for(const body of candidates)if(body.id!==p.target)for(const shape of patternCavities(body.shape,onProgress))holes.push({shape,bounds:bounds(shape)});
  // All holes have priority over all material, including later copies. A hole
  // is only a subtraction mask; it is never emitted as a new positive body.
  for(const body of candidates){let shape;try{
   onProgress?.({stage:'既存ボディの穴を切り取っています'});shape=cutBatch(body.shape,holes);const before=R.measureVolume(body.shape),after=R.measureVolume(shape),eps=Math.max(1e-7,before*1e-9);if(before-after<=eps)continue;
   cutBodies.push(body.id);if(after<=eps)remove.push(body.id);else output(body.id,shape);
  }finally{shape?.delete();}}
  for(const copy of copies){let shape;try{
   onProgress?.({stage:'穴を保って新規ボディを配置しています',current:copy.position,total:copies.length});shape=cutBatch(copy.shape,[...holes,...candidates,...created]);
   if(R.measureVolume(shape)<=1e-7){skipped.push(copy.position);continue;}
   const parts=shape.solids;try{parts.sort((a,b)=>{const x=bounds(a)[0],y=bounds(b)[0];return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];});for(const [index,part]of parts.entries()){const id=p.id+'-'+copy.position+(parts.length>1?'-'+(index+1):'');output(id,part);newBodies.push({id,position:copy.position});created.push({shape:part.clone(),bounds:bounds(part)});}}finally{parts.forEach(part=>part.delete());}
  }finally{shape?.delete();}}
  return {patternHybrid:{sourceHoles,cutBodies,newBodies,skippedPositions:skipped}};
 }catch(error){throw Object.assign(Error(p.operation+'を作成できませんでした。元のボディは変更していません。'+(error.message||'')),{cause:error});}
 finally{for(const item of [...copies,...holes,...created])item.shape.delete();}
}

function cutOnlyCircularPattern(base,p,center,axis,bodies,emit,remove,onProgress){
 const cutBodies=[],holes=[];let source=[];const result=()=>({patternHybrid:{cutOnly:true,sourceHoles:source.length,cutBodies,newBodies:[],skippedPositions:[]}});
 if(p.count===1)return result();
 try{
  if(p.targets&&(!Array.isArray(p.targets)||p.targets.some(id=>typeof id!=='string'||!bodies.has(id))))throw Error('パターンの対象ボディが見つかりません');const targets=p.targets?new Set(p.targets):null;
  source=patternCavities(base,onProgress);if(!source.length)throw Error('切り取り用の穴・くぼみが見つかりません。穴のある原型ボディを選択してください');
  for(const shape of source)for(let i=1;i<p.count;i++){const copy=shape.clone().rotate(p.angle*i/p.count,center,axis);holes.push({shape:copy,bounds:bounds(copy)});}
  const candidates=[...bodies].filter(([id])=>!targets||targets.has(id)||id===p.target).map(([id,shape])=>({id,shape,bounds:bounds(shape)})).filter(body=>holes.some(hole=>overlap(body.bounds,hole.bounds)));
  for(const [index,body]of candidates.entries()){let shape;try{
   onProgress?.({stage:'回転した穴が重なる部分だけを切り取っています',current:index+1,total:candidates.length});shape=cutBatch(body.shape,holes);const before=R.measureVolume(body.shape),after=R.measureVolume(shape),eps=Math.max(1e-7,before*1e-9);if(before-after<=eps)continue;
   cutBodies.push(body.id);if(after<=eps)remove.push(body.id);else emit(body.id,shape);
  }finally{shape?.delete();}}
  if(!cutBodies.length)throw Error('回転した穴・くぼみが既存ソリッドと重なっていません。中心・角度・個数を確認してください');
  return result();
 }finally{source.forEach(shape=>shape.delete());holes.forEach(item=>item.shape.delete());}
}
