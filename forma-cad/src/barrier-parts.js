import * as R from 'replicad';
const displayCache=new Map();let displayBytes=0;
function partMeshes(entries,token){
 let cached=token!==undefined&&displayCache.get(token);
 if(cached){displayCache.delete(token);displayCache.set(token,cached);return cached.meshes;}
 const meshes=entries.map(({solid})=>solid.mesh({tolerance:.08,angularTolerance:.15}));
 if(token!==undefined){const bytes=meshes.reduce((sum,mesh)=>sum+[mesh.vertices,mesh.triangles,mesh.normals].reduce((n,data)=>n+(data?.length||0)*8,0),0);displayCache.set(token,{meshes,bytes});displayBytes+=bytes;
  while(displayCache.size>8||displayBytes>8*1024*1024){const oldest=displayCache.keys().next().value;displayBytes-=displayCache.get(oldest).bytes;displayCache.delete(oldest);}
 }
 return meshes;
}

// Keys describe geometry, never transient OpenCascade hash codes or enumeration
// order. Changing the model invalidates a selection instead of picking another part.
export function barrierPartKey(solid){
 const box=solid.boundingBox;
 try{return JSON.stringify([...box.bounds.flat(),R.measureVolume(solid)].map(v=>Number(v.toFixed(5))));}
 finally{box.delete();}
}
export function selectBarrierParts(shape,keys,info,token){
 const solids=shape.solids;
 try{
  const entries=solids.map(solid=>({solid,key:barrierPartKey(solid)})).sort((a,b)=>a.key.localeCompare(b.key));
  if(keys?.some(key=>entries.filter(e=>e.key===key).length!==1))throw Error('押し出しの塊が変わりました。「全て残す」で更新してから塊を選び直してください');
  const chosen=entries.filter(e=>!keys||keys.includes(e.key));
  if(!chosen.length)throw Error('残す塊がありません。内側・外側や押し出し距離を確認してください');
  if(info){
   info.barrierFragments=entries.map(({solid,key},index)=>({key,index,selected:!keys||keys.includes(key),volume:R.measureVolume(solid)}));
   // Colour individual solids only when useful; avoid remeshing ordinary one-part previews.
   if(entries.length>1||keys){const meshes=partMeshes(entries,token);info.previewParts=entries.map(({key},index)=>({fragmentKey:key,fragmentIndex:index,fragmentSelected:!keys||keys.includes(key),...meshes[index]}));}
  }
  if(chosen.length===entries.length)return shape.clone();
  return chosen.length===1?chosen[0].solid.clone():R.makeCompound(chosen.map(e=>e.solid)).asShape3D();
 }finally{solids.forEach(s=>s.delete());}
}

// Full cylindrical inner walls define finite bore volumes, including rotated
// cylinders and blind holes. Partial curved walls/fillets are not bore evidence.
export function cylindricalInteriors(bodies){
 const bores=[],seen=new Set();
 try{for(const body of bodies){const faces=body.faces;
  try{for(const face of faces){
   if(face.geomType!=='CYLINDRE')continue;
   const bounds=face.UVBounds;if(bounds.uMax-bounds.uMin<Math.PI*2-1e-4||bounds.vMax-bounds.vMin<1e-6)continue;
   const surface=face.surface,cylinder=surface.wrapped.Cylinder(),location=cylinder.Location(),axis=cylinder.Axis(),direction=axis.Direction();let point,normal;
   try{
    const origin=[location.X(),location.Y(),location.Z()],dir=[direction.X(),direction.Y(),direction.Z()],radius=cylinder.Radius();
    point=face.pointOnSurface(.5,.5);const p=point.toTuple();normal=face.normalAt(p);const n=normal.toTuple(),v=p.reduce((sum,x,i)=>sum+(x-origin[i])*dir[i],0),radial=p.map((x,i)=>x-origin[i]-v*dir[i]);
    if(n.reduce((sum,x,i)=>sum+x*radial[i],0)>=0)continue;
    const start=origin.map((x,i)=>x+bounds.vMin*dir[i]),height=bounds.vMax-bounds.vMin,key=JSON.stringify([...start,...dir,radius,height].map(x=>Number(x.toFixed(5))));
    if(!seen.has(key)){seen.add(key);bores.push(R.makeCylinder(radius,height,start,dir));}
   }finally{point?.delete();normal?.delete();direction.delete();axis.delete();location.delete();cylinder.delete();surface.delete();}
  }}finally{faces.forEach(f=>f.delete());}
 }
 return bores;
 }catch(error){bores.forEach(b=>b.delete());throw error;}
}
export function restrictBarrierSide(shape,bodies,side='both'){
 if(side==='both')return shape.clone();
 const bores=cylindricalInteriors(bodies);let interior,result;
 try{
  if(!bores.length)throw Error('穴の内側を判定できません。内側・外側の指定には、全周つながった円筒の内壁が必要です。「両方」を選ぶと通常のバリア押し出しになります');
  interior=bores[0].clone();for(const bore of bores.slice(1)){const next=interior.fuse(bore);interior.delete();interior=next;}
  result=side==='inside'?shape.intersect(interior):shape.cut(interior);
  if(R.measureVolume(result)<=1e-9)throw Error('指定した内側・外側に押し出す形状がありません。距離・すき間を確認してください');
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!check.IsValid())throw Error('内側・外側を分けた形状が不正です。「両方」に戻すか、障害物の形状を確認してください');}finally{check.delete();}
  const output=result;result=null;return output;
 }finally{result?.delete();interior?.delete();bores.forEach(b=>b.delete());}
}
