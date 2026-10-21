import * as R from 'replicad';
import * as THREE from 'three';

const vector=point=>{try{return new THREE.Vector3(...point.toTuple());}finally{point.delete();}};
// Old saved joins retain their native face seams. Resolve a connected planar
// patch at operation time without rewriting the body or losing its holes/arcs.
export function selectedConnectedPlanarFace(base,selection){
 const faces=base.faces,point=R.makeVertex(selection.point),normal=selection.normal?new THREE.Vector3(...selection.normal).normalize():null;
 let compound,unifier,unified;
 try{
  const matches=faces.map((face,i)=>{let alignment=1;if(normal)try{alignment=vector(face.normalAt(selection.point)).normalize().dot(normal);}catch{}return {i,d:R.measureDistanceBetween(point,face),alignment};}).filter(r=>r.alignment>.3).sort((a,b)=>a.d-b.d);
  if(!matches.length||matches[0].d>.2)throw Error('押し出し元の面が見つかりません。面の中央寄りを選び直してください');
  const seed=faces[matches[0].i];if(seed.geomType!=='PLANE')throw Error('押し出す平面を選択し直してください');
  const n=vector(seed.normalAt()).normalize(),offset=n.dot(vector(seed.center)),candidates=[];
  for(const face of faces){if(face.geomType!=='PLANE'||vector(face.normalAt()).normalize().dot(n)<.999999||Math.abs(n.dot(vector(face.center))-offset)>1e-6)continue;const edges=face.edges;try{candidates.push({face,edges:new Set(edges.map(e=>e.hashCode))});}finally{edges.forEach(e=>e.delete());}}
  const start=candidates.find(r=>r.face===seed),parts=[start],seen=new Set(parts);
  for(let i=0;i<parts.length;i++)for(const c of candidates)if(!seen.has(c)&&[...c.edges].some(e=>parts[i].edges.has(e))){seen.add(c);parts.push(c);}
  if(parts.length===1)return seed.clone();
  compound=R.makeCompound(parts.map(r=>r.face.clone()));unifier=new (R.getOC().ShapeUpgrade_UnifySameDomain)(compound.wrapped,true,true,false);unifier.SetSafeInputMode(true);unifier.Build();unified=R.cast(unifier.Shape());
  const joined=unified.faces;
  try{
   const expected=parts.reduce((sum,r)=>sum+R.measureArea(r.face),0);
   if(joined.length!==1||Math.abs(R.measureArea(joined[0])-expected)>Math.max(1e-6,expected*1e-8))throw Error('つながった平面をまとめられませんでした。元のボディは変更していません');
   const check=new (R.getOC().BRepCheck_Analyzer)(joined[0].wrapped,true,false);try{if(!check.IsValid())throw Error('平面の境界を正常にまとめられませんでした。元のボディは変更していません');}finally{check.delete();}
   return joined[0].clone();
  }finally{joined.forEach(f=>f.delete());}
 }finally{unified?.delete();unifier?.delete();compound?.delete();point.delete();faces.forEach(f=>f.delete());}
}
