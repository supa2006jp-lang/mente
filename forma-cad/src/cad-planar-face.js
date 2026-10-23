import * as R from 'replicad';
import * as THREE from 'three';
import {basisFor} from './frames.js';

const vector=point=>{try{return new THREE.Vector3(...point.toTuple());}finally{point.delete();}};
// Old saved joins retain their native face seams. Resolve a connected planar
// patch at operation time without rewriting the body or losing its holes/arcs.
export function selectedConnectedPlanarFace(base,selection){
 return resolvePlanarFaces(base,selection)[0];
}

// The displayed profile can span old BREP seams which are not topologically
// shared. Keep every native face represented by that profile, including separate
// solids, rather than silently replacing the profile with its clicked half.
export function selectedProfilePlanarFaces(base,selection,region){
 return resolvePlanarFaces(base,selection,region);
}
function representedByProfile(face,region){
 const {u,v}=basisFor(region),mesh=face.mesh(),p=mesh.vertices,t=mesh.triangles;
 const contains=(ring,x,y)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 for(let i=0;i<t.length;i+=3){const center=new THREE.Vector3();for(let j=0;j<3;j++)center.add(new THREE.Vector3(...p.slice(t[i+j]*3,t[i+j]*3+3)));center.multiplyScalar(1/3);const x=center.dot(u),y=center.dot(v);if(contains(region.outer,x,y)&&!(region.holes||[]).some(h=>contains(h,x,y)))return true;}
 return false;
}
function resolvePlanarFaces(base,selection,region){
 const faces=base.faces,point=R.makeVertex(selection.point),normal=selection.normal?new THREE.Vector3(...selection.normal).normalize():region?basisFor(region).n:null;
 let compound,unifier,unified;
 try{
  // A plane and its tangent fillet both have zero distance at their boundary.
  // Resolve within the requested surface type and orientation before ranking;
  // native face order and display-coordinate rounding must not select the blend.
  const matches=faces.map((face,i)=>({face,i})).filter(({face})=>face.geomType==='PLANE').map(({face,i})=>({i,d:R.measureDistanceBetween(point,face),alignment:normal?vector(face.normalAt()).normalize().dot(normal):1})).filter(r=>r.alignment>.999999).sort((a,b)=>a.d-b.d);
  if(!matches.length||matches[0].d>.2)throw Error('押し出し元の面が見つかりません。面の中央寄りを選び直してください');
  const seed=faces[matches[0].i];
  const n=vector(seed.normalAt()).normalize(),offset=n.dot(vector(seed.center)),candidates=[];
  for(const face of faces){if(face.geomType!=='PLANE'||vector(face.normalAt()).normalize().dot(n)<.999999||Math.abs(n.dot(vector(face.center))-offset)>1e-6)continue;const edges=face.edges;try{candidates.push({face,edges:new Set(edges.map(e=>e.hashCode))});}finally{edges.forEach(e=>e.delete());}}
  const start=candidates.find(r=>r.face===seed),parts=region?candidates.filter(r=>r===start||representedByProfile(r.face,region)):[start],seen=new Set(parts);
  if(!region)for(let i=0;i<parts.length;i++)for(const c of candidates)if(!seen.has(c)&&[...c.edges].some(e=>parts[i].edges.has(e))){seen.add(c);parts.push(c);}
  if(parts.length===1)return [seed.clone()];
  compound=R.makeCompound(parts.map(r=>r.face.clone()));unifier=new (R.getOC().ShapeUpgrade_UnifySameDomain)(compound.wrapped,true,true,false);unifier.SetSafeInputMode(true);unifier.Build();unified=R.cast(unifier.Shape());
  const joined=unified.faces;
  try{
   const expected=parts.reduce((sum,r)=>sum+R.measureArea(r.face),0);
   if(!joined.length||(!region&&joined.length!==1)||Math.abs(joined.reduce((s,f)=>s+R.measureArea(f),0)-expected)>Math.max(1e-6,expected*1e-8))throw Error('つながった平面をまとめられませんでした。元のボディは変更していません');
   for(const face of joined){const check=new (R.getOC().BRepCheck_Analyzer)(face.wrapped,true,false);try{if(!check.IsValid())throw Error('平面の境界を正常にまとめられませんでした。元のボディは変更していません');}finally{check.delete();}}
   return joined.map(face=>face.clone());
  }finally{joined.forEach(f=>f.delete());}
 }finally{unified?.delete();unifier?.delete();compound?.delete();point.delete();faces.forEach(f=>f.delete());}
}
