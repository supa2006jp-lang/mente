import * as R from 'replicad';
import * as THREE from 'three';

const vector=point=>new THREE.Vector3(...point);
function sample(edge,t){const p=edge.pointAt(t);try{return p.toTuple();}finally{p.delete();}}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function failure(message,code){const error=new Error(message);error.code=code;return error;}

// Display chords are not exact CAD curves. Use the CAD distance operator, and
// retain segment endpoints so split collinear edges match the entire selection.
export function resolveFilletEdges(shape,{references=[],plane=null}={}){
 const edges=shape.edges,faces=shape.faces,records=[],byHash=new Map();
 try{
  for(const edge of edges){
   let samples;try{samples=[0,.25,.5,.75,1].map(t=>sample(edge,t));}catch{continue;}
   const box=edge.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}
   const record={edge,samples,bounds,faces:[]};records.push(record);const key=edge.hashCode;if(!byHash.has(key))byHash.set(key,[]);byHash.get(key).push(record);
  }
  for(const face of faces){const boundary=face.edges;try{for(const edge of boundary)for(const record of byHash.get(edge.hashCode)||[])if(record.edge.isSame(edge)&&!record.faces.includes(face))record.faces.push(face);}finally{boundary.forEach(edge=>edge.delete());}}
  for(const record of records){
   record.sharp=record.faces.length===2&&[1,2,3].some(index=>{
    const normals=record.faces.map(face=>face.normalAt(record.samples[index]));
    try{return Math.abs(vector(normals[0].toTuple()).normalize().dot(vector(normals[1].toTuple()).normalize()))<1-1e-7;}finally{normals.forEach(normal=>normal.delete());}
   });
  }
  const chosen=new Set();
  if(references.length){
   for(const ref of references){
    if(!Array.isArray(ref.point)||ref.point.length!==3||!ref.point.every(Number.isFinite))throw failure('選択した辺の座標が不正です。辺を選び直してください','fillet-selection');
    let candidates=records.filter(record=>ref.point.every((value,i)=>value>=record.bounds[0][i]-1&&value<=record.bounds[1][i]+1));
    if(ref.a&&ref.b){
     const line=new THREE.Line3(vector(ref.a),vector(ref.b)),tolerance=Math.max(.002,line.distance()*1e-5),nearest=new THREE.Vector3();
     const straight=records.filter(record=>record.edge.geomType==='LINE'&&record.samples.every(point=>line.closestPointToPoint(vector(point),true,nearest).distanceTo(vector(point))<=tolerance));
     if(straight.length){for(const record of straight)if(record.sharp)chosen.add(record.edge);if(!straight.some(record=>record.sharp))throw failure('選択した線は面の継ぎ目で、丸める角がありません。外周の角を選んでください','fillet-smooth');continue;}
     if(ref.curved){const curved=candidates.filter(record=>record.edge.geomType!=='LINE');if(curved.length)candidates=curved;}
    }
    const vertex=R.makeVertex(ref.point);let ranked;
    try{ranked=candidates.map(record=>({record,distance:R.measureDistanceBetween(vertex,record.edge)})).sort((a,b)=>a.distance-b.distance);}finally{vertex.delete();}
    if(!ranked.length||ranked[0].distance>1)throw failure('選択した辺をCAD形状上で特定できません。辺の中央付近を選び直してください','fillet-selection');
    const matching=ranked.filter(item=>item.distance<=ranked[0].distance+1e-5&&item.record.sharp);
    if(!matching.length)throw failure('選択した線は滑らかな面の継ぎ目で、丸める角がありません。外周の角を選んでください','fillet-smooth');
    if(matching.length>1)throw failure('頂点で複数の辺が重なっています。丸めたい辺の中央付近を選んでください','fillet-selection');
    chosen.add(matching[0].record.edge);
   }
  }else for(const record of records)if(record.sharp&&(!plane||record.samples.every(point=>Math.abs(vector(point).dot(vector(plane.normal))-plane.offset)<1e-4)))chosen.add(record.edge);
  if(!chosen.size)throw failure('丸められる角のある辺が見つかりません。辺または平面を選び直してください','fillet-selection');
  const kept=edges.filter(edge=>chosen.has(edge));for(const edge of edges)if(!chosen.has(edge))edge.delete();return kept;
 }catch(error){edges.forEach(edge=>edge.delete());throw error;}
 finally{faces.forEach(face=>face.delete());}
}

function build(shape,radius,selection){
 const edges=resolveFilletEdges(shape,selection),builder=new (R.getOC().BRepFilletAPI_MakeFillet)(shape.wrapped);let result;
 try{
  for(const edge of edges)builder.Add(radius,edge.wrapped);builder.Build();
  if(!builder.IsDone())throw failure('選択した辺の隣接面・交差・肉厚の条件でフィレットを作成できません。半径を小さくするか、辺を1本ずつ選んで確認してください','fillet-geometry');
  result=R.cast(builder.Shape()).asShape3D();if(!valid(result))throw failure('フィレット後の形状が不正になるため適用できません。隣接する短い辺・面の継ぎ目・薄い部分を確認してください','fillet-geometry');
  const output=result;result=null;return {shape:output,edgeCount:edges.length};
 }finally{result?.delete();builder.delete();edges.forEach(edge=>edge.delete());}
}

export function filletSolid(base,radius,selection={},onProgress){
 if(!Number.isFinite(radius)||radius<=0)throw failure('半径は0より大きくしてください','fillet-radius');
 if(!valid(base))throw failure('元のソリッドに形状の不整合があるためフィレットを作成できません。結合・切り取り前の形状を確認してください','fillet-input');
 let originalError;
 try{return {...build(base,radius,selection),normalized:false,radius};}catch(error){if(error.code&&error.code!=='fillet-geometry')throw error;originalError=error;}
 // Same-radius retry only: remove boolean split seams, never shrink the radius
 // or silently skip an unroundable selection. Safe mode preserves input data.
 onProgress?.({stage:'面の継ぎ目を整理して、同じ半径で再計算しています'});
 const oc=R.getOC(),upgrader=new oc.ShapeUpgrade_UnifySameDomain(base.wrapped,true,true,false);let normalized;
 try{
  upgrader.SetSafeInputMode(true);upgrader.Build();normalized=R.cast(upgrader.Shape()).asShape3D();
  const before=R.measureVolume(base),after=R.measureVolume(normalized);
  if(!valid(normalized)||Math.abs(after-before)>Math.max(1e-6,Math.abs(before)*1e-8))throw originalError;
  return {...build(normalized,radius,selection),normalized:true,radius};
 }catch(error){if(error.code==='fillet-smooth')throw error;throw originalError.code?originalError:failure('選択した辺の隣接面・交差・肉厚の条件でフィレットを作成できません。辺を1本ずつ選んで確認してください','fillet-geometry');}
 finally{normalized?.delete();upgrader.delete();}
}
