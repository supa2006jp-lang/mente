import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolids} from './solid-fuse.js';
import {canonicalRevolvedPlanes} from './revolved-planar-faces.js';
import {solidMeshComplete} from './solid-mesh.js';
const V=p=>new THREE.Vector3(...p),xyz=p=>[p.X(),p.Y(),p.Z()];
// gp_Cone/gp_Torus are not bound by the bundled OC runtime. Evaluate three
// equally spaced points on an exact circular iso-curve instead. Its centroid
// lies on the surface axis, also after arbitrary body transformations.
function circularSurfaceAxis(face){
 const surface=face.surface,{vMin,vMax}=face.UVBounds,v=face.geomType==='SPHERE'?0:(vMin+vMax)/2,points=[];
 try{
  for(const u of [0,2*Math.PI/3,4*Math.PI/3]){const point=surface.wrapped.Value(u,v);try{points.push(V(xyz(point)));}finally{point.delete();}}
  const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/3),direction=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
  if(direction.length()<1e-12)throw Error('回転曲面の軸を特定できません');return {center,dir:direction.normalize()};
 }finally{surface.delete();}
}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function unifySweep(shape){
 const volume=R.measureVolume(shape),allowance=Math.max(1e-6,Math.abs(volume)*1e-8);
 // Joining edge chains can invalidate a seam that face unification alone
 // handles correctly. Both attempts keep the input and the same tolerances.
 for(const edges of [true,false]){
  const upgrader=new (R.getOC().ShapeUpgrade_UnifySameDomain)(shape.wrapped,edges,true,false);let result;
  try{upgrader.SetSafeInputMode(true);upgrader.SetLinearTolerance(1e-7);upgrader.SetAngularTolerance(1e-7);upgrader.Build();result=R.cast(upgrader.Shape()).asShape3D();if(valid(result)&&Math.abs(R.measureVolume(result)-volume)<=allowance&&solidMeshComplete(result)){const output=result;result=null;return output;}}
  catch{}finally{result?.delete();upgrader.delete();}
 }
 if(valid(shape)&&solidMeshComplete(shape))return shape.clone();
 throw Error('回転範囲の面を整理できません');
}
function sweptFace(face,origin,axis,angle){
 const oc=R.getOC(),point=new oc.gp_Pnt(...origin),direction=new oc.gp_Dir(...axis),ax=new oc.gp_Ax1(point,direction),builder=new oc.BRepPrimAPI_MakeRevol(face.wrapped,ax,angle*Math.PI/180,true);
 let shape;
 try{if(!builder.IsDone())throw Error('この曲面の回転範囲を生成できません。回転軸や角度を変更してください');shape=R.cast(builder.Shape()).asShape3D();return canonicalRevolvedPlanes(shape);}finally{shape?.delete();builder.delete();ax.delete();direction.delete();point.delete();}
}
function advancingFace(face,origin,axis){
 // A new point in the union first enters through an advancing boundary.
 // Sweeping trailing faces repeats volumes already covered by these faces.
 for(const [u,v]of [[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]]){
  const sample=face.pointOnSurface(u,v),vertex=R.makeVertex(sample.toTuple()),extrema=new (R.getOC().BRepExtrema_DistShapeShape)(vertex.wrapped,face.wrapped);let point,normal;
  try{if(!extrema.IsDone()||!extrema.NbSolution())continue;point=extrema.PointOnShape2(1);const at=xyz(point);normal=face.normalAt(at);const speed=V(normal.toTuple()).normalize().dot(axis.clone().cross(V(at).sub(origin)));if(Math.abs(speed)>1e-8)return speed>0;}
  finally{normal?.delete();point?.delete();extrema.delete();vertex.delete();sample.delete();}
 }
 return false;
}
function partitionFaces(body,planes){
 if(!planes.length)return body.faces;
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Splitter(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape(),owned=[],source=body.faces,faces=[];let accepted=false;
 try{
  argumentsList.Append(body.wrapped);
  for(const {normal,origin}of planes){const point=new oc.gp_Pnt(...origin.toArray()),direction=new oc.gp_Dir(...normal.toArray()),plane=new oc.gp_Pln(point,direction),faceBuilder=new oc.BRepBuilderAPI_MakeFace(plane),face=faceBuilder.Face();owned.push(point,direction,plane,faceBuilder,face);tools.Append(face);}
  builder.SetArguments(argumentsList);builder.SetTools(tools);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();if(builder.HasErrors())throw Error('回転する形状の分割に失敗しました');
  // Only the original boundary can introduce new volume. Internal partition
  // faces duplicate swept tools and create avoidable coincident intersections.
  for(const face of source){const modified=builder.Modified(face.wrapped),list=new oc.NCollection_List_TopoDS_Shape(modified);try{if(list.IsEmpty()){if(!builder.IsDeleted(face.wrapped))faces.push(face.clone());}else for(;!list.IsEmpty();list.RemoveFirst()){const part=list.First(),oriented=part.Oriented(face.wrapped.Orientation());try{faces.push(R.cast(oriented));}finally{oriented.delete();part.delete();}}}finally{list.delete();modified.delete();}}
  if(!faces.length||faces.length>512)throw Error('回転する形状が複雑すぎます。ボディを分けて実行してください');accepted=true;return faces;
 }finally{if(!accepted)faces.forEach(face=>face.delete());source.forEach(face=>face.delete());builder.delete();argumentsList.delete();tools.delete();owned.reverse().forEach(item=>item.delete());}
}
// Partition where the surface changes from leading to trailing. Revolving
// these monotone faces produces volumes, rather than a rotated snapshot.
export function bodyRevolution(body,p,onProgress){
 const axis=V(p.axisVector).normalize(),origin=V(p.origin),planes=[];
 const components=axis.toArray(),dominant=components.reduce((j,v,i)=>Math.abs(v)>Math.abs(components[j])?i:j,0);
 if(components[dominant]<0)return bodyRevolution(body,{...p,axisVector:axis.negate().toArray(),direction:p.direction==='逆方向'?'片側':p.direction==='対称'?'対称':'逆方向'},onProgress);
 if(p.direction==='逆方向'||p.direction==='対称'){const shape=bodyRevolution(body,{...p,direction:'片側'},onProgress);return shape.rotate(p.direction==='逆方向'?-p.angle:-p.angle/2,p.origin,axis.toArray());}

 if(p.angle>90){const count=Math.ceil(p.angle/90),step=p.angle/count,piece=bodyRevolution(body,{...p,angle:step},onProgress),pieces=[piece];let combined;try{for(let i=1;i<count;i++)pieces.push(piece.clone().rotate(step*i,p.origin,axis.toArray()));combined=fuseSolids(pieces,{onProgress});return unifySweep(combined);}finally{combined?.delete();pieces.forEach(piece=>piece.delete());}}

 const addPlane=(normal,at=origin)=>{if(normal.length()<1e-7)return;normal.normalize();const a=normal.toArray(),dominant=a.reduce((j,v,i)=>Math.abs(v)>Math.abs(a[j])?i:j,0);if(a[dominant]<0)normal.negate();if(planes.some(plane=>Math.abs(plane.normal.dot(normal))>1-1e-7&&Math.abs(plane.origin.clone().sub(at).dot(normal))<1e-7))return;planes.push({normal,origin:at.clone()});};
 const sourceFaces=body.faces;
 try{for(const face of sourceFaces){
  const type=face.geomType;
  if(type==='PLANE'){const normal=face.normalAt();try{addPlane(V(normal.toTuple()).cross(axis));}finally{normal.delete();}continue;}
  if(!['CYLINDRE','CONE','SPHERE','TORUS'].includes(type))throw Error('この曲面のボディは回転範囲を正確に生成できません。平面の断面を選択して回転してください');
  const {center,dir}=circularSurfaceAxis(face),radial=center.clone().sub(origin).cross(axis);
  const alignment=Math.abs(dir.dot(axis));
  if(type==='CYLINDRE'&&alignment<1e-7){
   // For an orthogonal cylinder, n·(axis×(point-origin)) vanishes on two
   // planes: the axial station through the rotation origin, and the plane
   // through the cylinder axis parallel to both axes. Partition at both,
   // including their actual locations, before revolving the curved faces.
   addPlane(dir.clone());addPlane(axis.clone().cross(dir),center);continue;
  }
  if(type!=='SPHERE'&&alignment<1-1e-6)throw Error('この曲面の軸と回転軸の組み合わせには対応していません。円筒は平行または直交する軸を指定してください');
  if(type==='TORUS'&&radial.length()>1e-7){const {vMin,vMax}=face.UVBounds;for(let k=Math.ceil((vMin-Math.PI/2+1e-7)/Math.PI);Math.PI/2+k*Math.PI<vMax-1e-7;k++)throw Error('この丸みの回転範囲を正確に生成できません。丸みを分けて実行してください');}
  addPlane(radial);
 }}finally{sourceFaces.forEach(face=>face.delete());}
 onProgress?.({stage:'回転する曲面を正確に分割しています'});
 const faces=partitionFaces(body,planes),tools=[];let result=null;
 try{
  const direction=p.direction==='逆方向'?axis.clone().negate():axis;
  for(const [index,face]of faces.entries()){let sweep;try{
   onProgress?.({stage:'回転範囲を作成しています（'+(index+1)+' / '+faces.length+'面）'});
   if(!advancingFace(face,origin,direction))continue;
   sweep=sweptFace(face,p.origin,direction.toArray(),p.angle);const volume=R.measureVolume(sweep);if(Math.abs(volume)<1e-7)continue;if(volume<0)sweep.wrapped.Reverse();
   if(!valid(sweep))throw Error('回転範囲が自己交差しています。軸や角度を変更してください');
   tools.push(sweep);sweep=null;
  }finally{sweep?.delete();}}
  const joined=fuseSolids([body,...tools],{onProgress});try{result=unifySweep(joined);}finally{joined.delete();}
  if(p.direction==='対称'){const centered=result.rotate(-p.angle/2,p.origin,axis.toArray());if(centered!==result)result.delete();result=centered;}
  if(!valid(result)||R.measureVolume(result)<R.measureVolume(body)-1e-5)throw Error('回転範囲を有効なソリッドにできません。軸や角度を変更してください');
  const output=result;result=null;return output;
 }finally{result?.delete();for(const shape of [...faces,...tools])shape.delete();}
}
