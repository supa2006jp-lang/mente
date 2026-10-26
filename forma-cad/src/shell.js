import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';
import {shellCoaxialCircularLoft} from './circular-loft.js';

// The default rounded offset can return the unmodified solid where short
// planar faces meet circular walls. Join the offset surfaces by intersection
// on that failure, without rebuilding the original outline or changing depth.
function intersectingOffsetShell(base,faces,thickness,rounded=false){
 const oc=R.getOC(),list=new oc.NCollection_List_TopoDS_Shape(),builder=new oc.BRepOffsetAPI_MakeThickSolid();
 try{
  for(const face of faces)list.Append(face.wrapped);
  builder.MakeThickSolidByJoin(base.wrapped,list,-thickness,.001,oc.BRepOffset_Mode.BRepOffset_Skin,true,false,rounded?oc.GeomAbs_JoinType.GeomAbs_Arc:oc.GeomAbs_JoinType.GeomAbs_Intersection,false);
  return R.cast(builder.Shape()).asShape3D();
 }finally{builder.delete();list.delete();}
}

export function shellBody(base,p,circularLoftInfo=null){
 if(!Number.isFinite(p.thickness)||p.thickness<.1||p.thickness>1000)throw Error('壁厚は0.1〜1000 mmで指定してください');
 if(!p.faces?.length)throw Error('開口にする面を選択してください');
 const faces=selectedCadFaces(base,p.faces),original=R.measureVolume(base);
 const thickness=p.direction==='外側'?-p.thickness:p.thickness;
 const attempts=[()=>base.shell(thickness,face=>face.inList(faces))];
 // Preserve the inexpensive specialized recovery for old faceted lofts before
 // attempting general surface intersections on their many small side faces.
 if(faces.length===1&&circularLoftInfo)attempts.push(()=>shellCoaxialCircularLoft(base,faces[0],circularLoftInfo,p.thickness,p.direction));
 // Revolved swept bodies can have trimmed, overlapping offset surfaces. The
 // default rounded join does not intersect them globally; retain rounded joins
 // and enable that intersection before falling back to sharp surface joins.
 attempts.push(()=>intersectingOffsetShell(base,faces,thickness,true));
 attempts.push(()=>intersectingOffsetShell(base,faces,thickness));
 let reason='この壁厚ではシェルを作成できません。壁厚を小さくするか、開口面を変更してください';
 try{
  for(const build of attempts){
   let shape;
   try{shape=build();}catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;continue;}
   if(!shape)continue;
   let accepted=false;
   try{
    let valid=false,volume=NaN;
    try{
     const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
     try{valid=check.IsValid();}finally{check.delete();}
     volume=R.measureVolume(shape);
    }catch{}
    if(valid&&Number.isFinite(volume)&&volume>1e-8&&(p.direction==='外側'||original-volume>Math.max(1e-7,original*1e-8))){accepted=true;return shape;}
    reason=valid&&Number.isFinite(volume)&&volume>1e-8?'シェル計算で内側の空間を作れませんでした。壁厚や開口面を確認してください':'有効なシェルを作成できません。壁厚と選択面を確認してください';
   }finally{if(!accepted)shape.delete();}
  }
  throw Error(reason);
 }finally{faces.forEach(face=>face.delete());}
}

// Offset the original body, then remove that same cavity from the decorated
// body. Fine relief outlines remain outside instead of becoming offset walls.
export function shellDecoratedBody(base,source,p,circularLoftInfo=null,radius=null,onRemoved=null){
 if(!source)throw Error('模様の元になったボディが見つかりません');
 if(p.direction==='外側')throw Error('模様を保持するシェルは内側を選択してください');
 if(radius!==null&&p.thickness>=radius-1e-7)throw Error('壁厚が円柱の半径以上のため、内側の空間を作れません。壁厚を小さくしてください');
 let hollow,cavity,result,accepted=false;
 try{
  hollow=shellBody(source,p,circularLoftInfo);
  cavity=source.cut(hollow);
  const cavityVolume=R.measureVolume(cavity),original=R.measureVolume(base);
  if(!(cavityVolume>1e-7))throw Error('この壁厚では内側の空間を作れません');
  result=base.cut(cavity);
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);
  try{if(!check.IsValid())throw Error('模様を保持したシェルを作成できません。壁厚を変更してください');}
  finally{check.delete();}
  const volume=R.measureVolume(result),solids=result.solids,sourceSolids=base.solids;
  try{
   if(solids.length!==sourceSolids.length||!Number.isFinite(volume)||volume<=1e-8||original-volume<=Math.max(1e-7,original*1e-8))throw Error('この壁厚では模様を保持したシェルを作成できません');
  }finally{for(const solid of [...solids,...sourceSolids])solid.delete();}
  onRemoved?.(cavity);accepted=true;return result;
 }finally{hollow?.delete();cavity?.delete();if(!accepted)result?.delete();}
}
