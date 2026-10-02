import * as R from 'replicad';
import * as THREE from 'three';
const V=p=>new THREE.Vector3(...p),xyz=p=>[p.X(),p.Y(),p.Z()];
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
// Partition where the surface changes from leading to trailing. Revolving
// these monotone faces produces volumes, rather than a rotated snapshot.
export function bodyRevolution(body,p){
 const axis=V(p.axisVector).normalize(),origin=V(p.origin),planes=[];
 const components=axis.toArray(),dominant=components.reduce((j,v,i)=>Math.abs(v)>Math.abs(components[j])?i:j,0);
 if(components[dominant]<0)return bodyRevolution(body,{...p,axisVector:axis.negate().toArray(),direction:p.direction==='逆方向'?'片側':p.direction==='対称'?'対称':'逆方向'});
 if(p.direction==='逆方向'||p.direction==='対称'){const shape=bodyRevolution(body,{...p,direction:'片側'});return shape.rotate(p.direction==='逆方向'?-p.angle:-p.angle/2,p.origin,axis.toArray());}

 if(p.angle>90){const count=Math.ceil(p.angle/90),step=p.angle/count,piece=bodyRevolution(body,{...p,angle:step,direction:p.direction==='対称'?'片側':p.direction});let result=piece.clone();try{for(let i=1;i<count;i++){const rotated=piece.clone().rotate((p.direction==='逆方向'?-1:1)*step*i,p.origin,axis.toArray());try{const joined=result.fuse(rotated);result.delete();result=joined;}finally{rotated.delete();}}if(p.direction==='対称')result=result.rotate(-p.angle/2,p.origin,axis.toArray());if(!valid(result))throw Error('回転範囲の結合に失敗しました。角度を小さくしてください');const out=result;result=null;return out;}finally{result?.delete();piece.delete();}}

 const addPlane=normal=>{if(normal.length()<1e-7)return;normal.normalize();const a=normal.toArray(),dominant=a.reduce((j,v,i)=>Math.abs(v)>Math.abs(a[j])?i:j,0);if(a[dominant]<0)normal.negate();if(planes.some(n=>Math.abs(n.dot(normal))>1-1e-7))return;planes.push(normal);};
 for(const face of body.faces){
  if(face.geomType==='PLANE'){addPlane(new THREE.Vector3(...face.normalAt().toTuple()).cross(axis));continue;}
  const surface=face.surface.wrapped;let center,dir;
  if(face.geomType==='CYLINDRE'){const c=surface.Cylinder();center=xyz(c.Location());dir=xyz(c.Axis().Direction());}
  else if(face.geomType==='CONE'){const c=surface.Cone();center=xyz(c.Location());dir=xyz(c.Axis().Direction());}
  else if(face.geomType==='SPHERE'){center=xyz(surface.Sphere().Location());}
  else throw Error('この曲面のボディは回転範囲を正確に生成できません。平面の断面を選択して回転してください');
  if(dir&&Math.abs(V(dir).dot(axis))<1-1e-6)throw Error('円筒・円錐を含むボディは、その中心軸と平行な回転軸を指定してください');
  addPlane(V(center).sub(origin).cross(axis));
 }
 let parts=[body.clone()],result=null;
 try{
  for(const normal of planes){const u=Math.abs(normal.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);u.addScaledVector(normal,-u.dot(normal)).normalize();const plane=new R.Plane(p.origin,u.toArray(),normal.toArray()),next=[];
   try{for(const part of parts){const split=part.split(plane);for(const piece of [split.positive,split.negative])if(piece)next.push(piece);}}
   catch(e){for(const piece of next)piece.delete();throw e;}
   for(const part of parts)part.delete();parts=next;if(parts.length>64)throw Error('回転する形状が複雑すぎます。ボディを分けて実行してください');
  }
  const direction=p.direction==='逆方向'?axis.clone().negate():axis;
  result=body.clone();
  for(const face of parts.flatMap(part=>part.faces)){let sweep;try{
   sweep=R.revolution(face,p.origin,direction.toArray(),p.angle);const volume=R.measureVolume(sweep);if(Math.abs(volume)<1e-7)continue;if(volume<0)sweep.wrapped.Reverse();
   if(!valid(sweep))throw Error('回転範囲が自己交差しています。軸や角度を変更してください');
   const joined=result.fuse(sweep);result.delete();result=joined;
  }finally{sweep?.delete();}}
  if(p.direction==='対称'){const centered=result.rotate(-p.angle/2,p.origin,axis.toArray());if(centered!==result)result.delete();result=centered;}
  if(!valid(result)||R.measureVolume(result)<R.measureVolume(body)-1e-5)throw Error('回転範囲を有効なソリッドにできません。軸や角度を変更してください');
  const output=result;result=null;return output;
 }finally{result?.delete();for(const part of parts)part.delete();}
}
