import * as R from 'replicad';
import * as THREE from 'three';
import {rasterRelief,rasterResolution} from './raster-relief.js';
function rasterEnvelope(spec,info,relief,count,onProgress){
 const oc=R.getOC(),resolution=rasterResolution(spec.raster,spec.rasterSettings,spec.seam,spec.repeatCount),segments=resolution.segments,perTile=segments/count,vCount=resolution.rows+1,c=Math.cos(Math.PI/segments),angle=spec.angle*Math.PI/180,sign=spec.operation==='engrave'?-1:1,faces=[];
 // Each repeated face shares one detailed surface instead of spending a fixed
 // full-circle sampling budget on all copies. Rigid locations keep the native
 // surface shared in the saved BREP. Additional vertical controls retain edges.
 const tileFace=tile=>{
  const uCount=2*perTile+1,objects=[],keep=o=>(objects.push(o),o);
  const poles=keep(new oc.NCollection_Array2_gp_Pnt(1,uCount,1,vCount)),weights=keep(new oc.NCollection_Array2_double(1,uCount,1,vCount)),uk=keep(new oc.NCollection_Array1_double(1,perTile+1)),um=keep(new oc.NCollection_Array1_int(1,perTile+1)),vk=keep(new oc.NCollection_Array1_double(1,vCount-2)),vm=keep(new oc.NCollection_Array1_int(1,vCount-2));
  try{
   for(let i=0;i<=perTile;i++){uk.SetValue(i+1,i);um.SetValue(i+1,i===0||i===perTile?3:2);}
   const span=vCount-3,fullKnots=[0,0,0,0,...Array.from({length:span-1},(_,i)=>i+1),span,span,span,span];for(let j=0;j<=span;j++){vk.SetValue(j+1,j);vm.SetValue(j+1,j===0||j===span?4:1);}
   for(let j=0;j<vCount;j++){const v=(fullKnots[j+1]+fullKnots[j+2]+fullKnots[j+3])/(3*span),z=spec.offset+spec.height*v;
    onProgress?.({stage:'画像の細部から曲面を作成しています',current:j+1,total:vCount});
    const middle=i=>{const u=(tile*perTile+i+.5)/segments,a=u*2*Math.PI+angle,value=j<2||j>=vCount-2?0:relief.sample(u,v,spec.seam,spec.repeatCount),r=(info.radius+sign*spec.depth*value)/c;return [r*Math.cos(a),r*Math.sin(a),z];};
    for(let i=0;i<uCount;i++){const index=Math.floor(i/2),p=i%2?middle(index):middle(index).map((a,k)=>(a+middle(index-1)[k])/2),point=new oc.gp_Pnt(...p);try{poles.SetValue(i+1,j+1,point);weights.SetValue(i+1,j+1,i%2?c:1);}finally{point.delete();}}
   }
   const surface=keep(new oc.Geom_BSplineSurface(poles,weights,uk,vk,um,vm,2,3,false,false)),maker=keep(new oc.BRepBuilderAPI_MakeFace(surface,1e-7));return new R.Face(maker.Face());
  }finally{for(const object of objects.toReversed())object.delete();}
 };
 const cap=z=>{const edge=R.makeCircle(info.radius,[0,0,z]),wire=R.assembleWire([edge]);try{return R.makeFace(wire);}finally{wire.delete();edge.delete();}};
 try{
  if(spec.seam==='repeat'){
   const prototype=tileFace(0);faces.push(prototype);
   for(let tile=1;tile<count;tile++){const transform=new R.Transformation();let maker;try{transform.rotate(tile*360/count);maker=new oc.BRepBuilderAPI_Transform(prototype.wrapped,transform.wrapped,false,false);faces.push(new R.Face(maker.Shape()));}finally{maker?.delete();transform.delete();}}
  }else for(let tile=0;tile<count;tile++)faces.push(tileFace(tile));
  faces.push(cap(spec.offset),cap(spec.offset+spec.height));onProgress?.({stage:'曲面の境界を接合しています',current:1,total:1});const envelope=R.makeSolid(faces);onProgress?.({stage:'曲面の境界を接合しました',current:1,total:1});return envelope;
 }finally{for(const face of faces)face.delete();}
}
export function wrapRasterSolid(base,spec,info,onProgress){
 const relief=rasterRelief(spec.raster,spec.rasterSettings),count=spec.seam==='repeat'?spec.repeatCount:spec.seam==='mirror'?2:1;
 if(!Number.isInteger(count)||count<1||count>12)throw Error('画像の繰り返しが細かすぎます。1枚の幅を大きくするか、細かさを上げてください');
 if(relief.values.reduce((a,b)=>Math.max(a,b),0)<1e-5)throw Error('凹凸にできる明るい部分がありません。白黒を反転するか画像を変更してください');
 const {radius,height:bodyHeight}=info,sign=spec.operation==='engrave'?-1:1,margin=Math.min(.25,radius*.05),innerRadius=radius-(sign<0?spec.depth:0)-margin;
 if(innerRadius<=.1)throw Error('凹凸の深さを小さくしてください');
 let envelope,core,tool,outer,inner,band,remainder,placed,result;
 const axis=new THREE.Vector3(...info.axis),z=new THREE.Vector3(0,0,1),rotation=z.clone().cross(axis);if(rotation.lengthSq()<1e-16)rotation.set(1,0,0);else rotation.normalize();const turn=z.angleTo(axis)*180/Math.PI;
 const place=shape=>{const oc=R.getOC(),rotationTransform=new R.Transformation(),translationTransform=new R.Transformation();let rotated,moved;try{rotationTransform.rotate(turn,[0,0,0],rotation.toArray());translationTransform.translate(info.origin);rotated=new oc.BRepBuilderAPI_Transform(shape.wrapped,rotationTransform.wrapped,false,false);moved=new oc.BRepBuilderAPI_Transform(rotated.Shape(),translationTransform.wrapped,false,false);return R.cast(moved.Shape()).asShape3D();}finally{moved?.delete();rotated?.delete();translationTransform.delete();rotationTransform.delete();}};
 try{
  envelope=rasterEnvelope(spec,info,relief,count,onProgress);onProgress?.({stage:'円柱との接合を準備しています',current:1,total:1});
  // Every local spline support spans less than 90 degrees. Its positive rational
  // weights keep radii between the minimum and maximum height controls. A second
  // cylinder clamp is redundant and expensive on detailed, repeated drawings.
  if(sign<0){outer=R.makeCylinder(radius+.01,spec.height,[0,0,spec.offset]);tool=outer.cut(envelope);placed=place(tool);onProgress?.({stage:'画像の凹凸を彫り込んでいます',current:2,total:3});result=base.cut(placed);}
  else{core=R.makeCylinder(innerRadius,bodyHeight+2,[0,0,-1]);tool=envelope.cut(core);placed=place(tool);
  // Replace only a thin outer band; the inner cavity and bottom remain intact.
  outer=R.makeCylinder(radius+.01,spec.height,[0,0,spec.offset]);inner=R.makeCylinder(innerRadius+.05,spec.height+2,[0,0,spec.offset-1]);band=outer.cut(inner);
  const contactOuter=R.makeCylinder(radius,spec.height,[0,0,spec.offset]);let contactBand,positionedContact,present;try{contactBand=contactOuter.cut(inner);positionedContact=place(contactBand);present=base.intersect(positionedContact);const expected=R.measureVolume(contactBand);if(Math.abs(R.measureVolume(present)-expected)>Math.max(.001,expected*1e-5))throw Error('模様の範囲に穴や薄い壁があります。範囲を狭くするか、壁厚を増やしてください');}finally{present?.delete();positionedContact?.delete();contactBand?.delete();contactOuter.delete();}
  const positionedBand=place(band);try{remainder=base.cut(positionedBand);}finally{positionedBand.delete();}
  onProgress?.({stage:'画像の凹凸を本体に接合しています',current:2,total:3});
  // A detailed trimmed spline has approximate volume quadrature; validate its
  // topology and cavity directly instead of comparing separately integrated volumes.
  result=remainder.fuse(placed);}
  const oc=R.getOC(),check=new oc.BRepCheck_Analyzer(result.wrapped,true,false),before=base.solids,after=result.solids;try{if(!check.IsValid()||after.length!==before.length||!(R.measureVolume(result)>0))throw Error('この画像では正常なソリッドを作れません。滑らかさを上げるか、凹凸を小さくしてください');}finally{check.delete();for(const s of [...before,...after])s.delete();}
  onProgress?.({stage:'画像の凹凸を確認しています',current:3,total:3});const shape=result;result=null;return {shape,info};
 }finally{result?.delete();placed?.delete();remainder?.delete();band?.delete();inner?.delete();outer?.delete();tool?.delete();core?.delete();envelope?.delete();}
}
