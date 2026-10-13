import * as R from 'replicad';
import {basisFor} from './frames.js';
import {validateRegion} from './regions.js';

export function validateExtrusionOverlap(f){
 if(f.overlapOnly!==undefined&&typeof f.overlapOnly!=='boolean')throw Error('重なる部分だけの押し出し設定が不正です');
 if(!f.overlapOnly)return;
 if(f.region?.overlapSource){validateRegion(f.region.overlapSource);if(f.region.overlapSource.overlapSource)throw Error('重なりの元領域が不正です');}
 if(f.region?.overlapPoint&&(!Array.isArray(f.region.overlapPoint)||f.region.overlapPoint.length!==3||f.region.overlapPoint.some(v=>!Number.isFinite(v)||Math.abs(v)>25000)))throw Error('重なる領域の選択位置が不正です');
 if(f.mode!=='solid'||f.holesOnly)throw Error('重なる部分だけの押し出しは通常の押し出しで使用してください');
 if(!Array.isArray(f.overlapTargets)||!f.overlapTargets.length||f.overlapTargets.length>100||new Set(f.overlapTargets).size!==f.overlapTargets.length||f.overlapTargets.some(id=>typeof id!=='string'||!id||id.length>100))throw Error('重なりを判定する対象ボディを選択してください');
}

export function commonSection(face,body){
 const oc=R.getOC(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape(),builder=new oc.BRepAlgoAPI_Common();
 let raw;
 try{
  argumentsList.Append(face.wrapped);tools.Append(body.wrapped);builder.SetArguments(argumentsList);builder.SetTools(tools);
  builder.SetNonDestructive(true);builder.SetToFillHistory(false);builder.SetFuzzyValue(1e-7);builder.Build();
  if(!builder.IsDone()||builder.HasErrors())throw Error('スケッチとソリッドの重なりを計算できませんでした');
  raw=builder.Shape();return raw.IsNull()?null:R.cast(raw);
 }finally{raw?.delete();builder.delete();tools.delete();argumentsList.delete();}
}

// Intersect the sketch-plane face with the actual BREP, then extrude that
// section. Never use a screen silhouette or intersect the finished extrusion
// with the original body: that would discard the outward extension.
export function overlappingProfileSolid(f,bodies,makeUnclipped){
 validateExtrusionOverlap(f);
 const targets=f.overlapTargets.map(id=>bodies?.get(id));
 if(targets.some(body=>!body))throw Error('重なりを判定するボディが見つかりません。対象を選び直してください');
 const normal=basisFor(f.region||f).n,offset=f.region?.offset??normal.x*f.x+normal.y*f.y+normal.z*f.z;
 const probe=makeUnclipped({...f,region:f.region?.overlapSource||f.region,overlapOnly:false,throughAll:false,depth:1}),faces=probe.faces;
 const selection=f.region?.overlapPoint?R.makeVertex(f.region.overlapPoint):null;
 const vector=new R.Vector(normal.clone().multiplyScalar(f.depth).toArray());let combined;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const center=face.center,n=face.normalAt();
   let start;
   try{start=Math.abs(normal.dot({x:center.x,y:center.y,z:center.z})-offset)<1e-6&&Math.abs(normal.dot({x:n.x,y:n.y,z:n.z}))>.999999;}
   finally{center.delete();n.delete();}
   if(!start)continue;
   for(const target of targets){
    const section=commonSection(face,target);if(!section)continue;
    const sections=section.faces;
    try{
     for(const patch of sections){
      if(R.measureArea(patch)<1e-7)continue;
      if(selection&&R.measureDistanceBetween(patch,selection)>1e-4)continue;
      const part=R.basicFaceExtrusion(patch,vector);
      try{
       const volume=R.measureVolume(part);if(Math.abs(volume)<1e-8)continue;
       if(volume<0)part.wrapped.Reverse();
       const next=combined?combined.fuse(part):part.clone();combined?.delete();combined=next;
      }finally{part.delete();}
     }
    }finally{sections.forEach(patch=>patch.delete());section.delete();}
   }
  }
  if(!combined)throw Error('スケッチ平面上でソリッドと重なる部分がありません。平面位置と対象を確認してください');
  const result=combined;combined=null;return result;
 }finally{selection?.delete();combined?.delete();vector.delete();faces.forEach(face=>face.delete());probe.delete();}
}
