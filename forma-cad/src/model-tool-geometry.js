import * as R from 'replicad';
import * as THREE from 'three';
import {cadMesh} from './cad-mesh.js';

const v=p=>new THREE.Vector3(...p), tuple=p=>{try{return p.toTuple();}finally{p.delete();}};
const bounds=shape=>{const b=shape.boundingBox;try{return b.bounds.map(p=>[...p]);}finally{b.delete();}};
const solids=shape=>shape instanceof R.Solid?[shape.clone()]:shape.solids;
const volume=shape=>Math.abs(R.measureVolume(shape));
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid()&&volume(shape)>1e-8;}finally{check.delete();}}
function output(shape,id){const faces=shape.faces;try{return {id,...cadMesh(shape),cadCoordinatePrecision:true,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:shape.serialize()};}finally{faces.forEach(f=>f.delete());}}
function selection(bodies,targets){if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||targets.some(id=>!bodies.has(id)))throw Error('対象ボディを選び直してください');return targets.map(id=>[id,bodies.get(id)]);}
function cylinder(face){
 if(face.geomType!=='CYLINDRE')return null;
 const surface=face.surface,c=surface.wrapped.Cylinder(),axis=c.Axis(),dir=axis.Direction(),loc=c.Location();
 try{const origin=v([loc.X(),loc.Y(),loc.Z()]),n=v([dir.X(),dir.Y(),dir.Z()]),center=v(tuple(face.pointOnSurface(.5,.5))),radial=center.clone().sub(origin);radial.addScaledVector(n,-radial.dot(n));const normal=v(tuple(face.normalAt(center.toArray()))),uv=face.UVBounds;return {origin,n,radius:c.Radius(),internal:normal.dot(radial)<0,min:uv.vMin,max:uv.vMax,full:uv.uMax-uv.uMin>Math.PI*2-1e-5};}
 finally{loc.delete();dir.delete();axis.delete();c.delete();surface.delete();}
}
function slab(face,distance){
 const builder=new (R.getOC().BRepOffsetAPI_MakeThickSolid)();
 try{builder.MakeThickSolidBySimple(face.wrapped,distance);let result=R.cast(builder.Shape()).asShape3D();if(R.measureVolume(result)<0){const oriented=R.cast(result.wrapped.Reversed()).asShape3D();result.delete();result=oriented;}return result;}finally{builder.delete();}
}
function modify(shape,face,distance){
 if(Math.abs(distance)<1e-7)return shape.clone();let tool;const c=cylinder(face);
 if(c?.full){const next=c.radius+(c.internal?-distance:distance);if(next<.05)throw Error('指定寸法では円筒の空間が塞がります');const point=c.origin.clone().addScaledVector(c.n,c.min).toArray(),outer=R.makeCylinder(Math.max(next,c.radius),c.max-c.min,point,c.n.toArray()),inner=R.makeCylinder(Math.min(next,c.radius),c.max-c.min,point,c.n.toArray());try{tool=outer.cut(inner);}finally{outer.delete();inner.delete();}}
 else tool=slab(face,distance);
 try{return (distance>0?shape.fuse(tool):shape.cut(tool)).simplify();}finally{tool.delete();}
}
function expandedFace(face,amount){
 const offsetWire=(wire,grow)=>{const old=R.makeFace(wire.clone()),oldArea=R.measureArea(old);old.delete();let next=wire.clone().offset2D(amount,'intersection'),test=R.makeFace(next.clone()),newArea=R.measureArea(test);test.delete();if((newArea>oldArea)!==grow){next.delete();next=wire.clone().offset2D(-amount,'intersection');}wire.delete();return next;};
 const outer=offsetWire(face.clone().outerWire(),true),holes=face.clone().innerWires().map(w=>offsetWire(w,false));
 try{let expanded=R.makeFace(outer,holes);if(v(tuple(expanded.normalAt())).dot(v(tuple(face.normalAt())))<0){const flipped=expanded.flipOrientation();if(flipped!==expanded)expanded.delete();expanded=flipped;}return expanded;}finally{outer.delete();holes.forEach(w=>w.delete());}
}
function extentWithin(a,b,eps=1e-5){return a.every((p,i)=>p.every((x,j)=>i?x<=b[i][j]+eps:x>=b[i][j]-eps));}

// Measure true CAD solids: a closed cavity has multiple boundary shells but is
// still one solid. A component overlay is geometry, not a bounding-box guess.
export function inspectBodyComponents(bodies,spec,onProgress){
 const rows=[];
 for(const [index,[id,shape]] of selection(bodies,spec.targets||[...bodies.keys()]).entries()){
  onProgress?.({stage:'CADの連結した部品を確認しています',current:index+1,total:bodies.size});
  const parts=solids(shape);
  try{if(parts.length>200&&spec.includeMeshes!==false)throw Error('1ボディ内の部品が200個を超えています。ボディを分けて検査してください');rows.push({id,count:parts.length,components:parts.map((part,i)=>({index:i,volume:volume(part),bounds:bounds(part),...(spec.includeMeshes===false?{}:part.mesh({tolerance:.08,angularTolerance:.15}))}))});}finally{parts.forEach(p=>p.delete());}
 }
 return {rows,total:rows.reduce((n,r)=>n+r.count,0),disconnected:rows.filter(r=>r.count>1).length};
}

export function resizeBodies(bodies,spec,onProgress){
 const factor=Number(spec.factor),wall=Number(spec.wall),sourceWall=Number(spec.sourceWall),gap=Number(spec.gap);
 if(!Number.isFinite(factor)||factor<.01||factor>100)throw Error('倍率は1〜10000%で指定してください');
 if(spec.keepWall&&(!Number.isFinite(wall)||wall<.1||wall>100||!Number.isFinite(sourceWall)||sourceWall<.1||sourceWall>100))throw Error('変更前と変更後の壁厚を0.1〜100 mmで指定してください');
 if(spec.keepGap&&(!Number.isFinite(gap)||gap<.01||gap>100))throw Error('維持する元のすき間を0.01〜100 mmで指定してください');
 const selected=selection(bodies,spec.targets),pivot=spec.pivot||[0,0,0];
 if(!Array.isArray(pivot)||pivot.length!==3||pivot.some(n=>!Number.isFinite(n)))throw Error('拡大縮小の基準点が不正です');
 const prepared=new Map(),analysis={factor,wall:spec.keepWall?wall:null,wallFaces:0,holeFaces:0,gaps:0,bodies:[]};
 try{
  for(const [index,[id,base]] of selected.entries()){
   onProgress?.({stage:'サイズと指定寸法を調整しています',current:index+1,total:selected.length});
   const scaled=base.clone().scale(factor,pivot),box=bounds(scaled),faces=scaled.faces,records=faces.map((face,i)=>({face,i,center:v(tuple(face.center)),normal:v(tuple(face.normalAt())),area:R.measureArea(face),cylinder:cylinder(face)}));
   let next=scaled.clone(),wallFaces=new Map(),holeCount=0,keptHoles=[];
   try{
    if(spec.keepWall&&Math.abs(wall-sourceWall*factor)>1e-6){
     if(faces.length>400)throw Error('壁厚維持は400面以下の均一な平面・円筒壁で行ってください。対象を分けるか、倍率だけの変更を選んでください');
     const current=sourceWall*factor,tolerance=Math.max(1e-5,current*.002),center=v(box[0]).add(v(box[1])).multiplyScalar(.5);
     for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
      const a=records[i],b=records[j];
      if(a.face.geomType==='PLANE'&&b.face.geomType==='PLANE'&&a.normal.dot(b.normal)<-.999999){
       const d=-b.center.clone().sub(a.center).dot(a.normal);if(Math.abs(d-current)>tolerance||Math.abs(R.measureDistanceBetween(a.face,b.face)-current)>tolerance)continue;
       const candidates=[a,b].filter(r=>{const fb=bounds(r.face),delta=wall-current;return extentWithin(fb.map(p=>p.map((x,k)=>x+r.normal.getComponent(k)*delta)),box);});
       if(!candidates.length)throw Error('外寸を維持したまま指定の壁厚にできません。倍率または壁厚を見直してください');
       candidates.sort((x,y)=>Math.abs(x.area-y.area)>Math.max(x.area,y.area)*1e-5?x.area-y.area:x.normal.dot(x.center.clone().sub(center))-y.normal.dot(y.center.clone().sub(center))||x.normal.z-y.normal.z);
       wallFaces.set(candidates[0].i,{record:candidates[0],distance:wall-current});
      }
      const ca=a.cylinder,cb=b.cylinder;if(ca&&cb&&ca.internal!==cb.internal&&Math.abs(ca.radius-cb.radius)>1e-6&&Math.abs(Math.abs(ca.radius-cb.radius)-current)<tolerance&&Math.abs(ca.n.dot(cb.n))>.999999&&ca.origin.clone().sub(cb.origin).cross(ca.n).length()<1e-5&&Math.abs(R.measureDistanceBetween(a.face,b.face)-current)<tolerance){const inner=ca.internal?a:b;if(inner.cylinder.radius-(wall-current)<.05)throw Error('指定した壁厚では円筒の内側が塞がります');wallFaces.set(inner.i,{record:inner,distance:wall-current});}
     }
     if(!wallFaces.size)throw Error('入力した元の壁厚に一致する均一壁を特定できません。元の壁厚を確認してください。曲面や可変厚の壁は倍率だけの変更を選んでください');
     for(const {record,distance} of wallFaces.values()){const face=distance<0&&record.face.geomType==='PLANE'?expandedFace(record.face,-distance):record.face;try{const changed=modify(next,face,distance);next.delete();next=changed;}finally{if(face!==record.face)face.delete();}}
     if(!extentWithin(bounds(next),box)||!extentWithin(box,bounds(next)))throw Error('壁厚調整で外寸が変わるため中止しました。対象を分けてください');
    }
    if(spec.keepHoles){
     for(const record of records){const c=record.cylinder;if(!c?.internal||!c.full||wallFaces.has(record.i))continue;
      // Cylinders belonging to a tube wall follow the wall constraint instead.
      if(records.some(other=>other.cylinder&&!other.cylinder.internal&&Math.abs(other.cylinder.n.dot(c.n))>.999999&&other.cylinder.origin.clone().sub(c.origin).cross(c.n).length()<1e-5))continue;
      const distance=c.radius-c.radius/factor,changed=modify(next,record.face,distance);next.delete();next=changed;holeCount++;keptHoles.push({...c,radius:c.radius/factor});
     }
    }
    if(!valid(next))throw Error('サイズ変更後の形状を作れません。倍率・壁厚・穴径を見直してください');
    const finalFaces=next.faces;
    try{
     const finalRecords=finalFaces.map(face=>({face,normal:v(tuple(face.normalAt())).normalize(),center:v(tuple(face.center)),cylinder:cylinder(face)}));
     const matchingCylinder=c=>finalRecords.some(r=>r.cylinder&&r.cylinder.internal&&Math.abs(r.cylinder.radius-c.radius)<1e-5&&Math.abs(r.cylinder.n.dot(c.n))>.999999&&r.cylinder.origin.clone().sub(c.origin).cross(c.n).length()<1e-5&&(!c.full||r.cylinder.full));
     for(const {record,distance} of wallFaces.values()){
      const c=record.cylinder,exists=c?matchingCylinder({...c,radius:c.radius-distance}):finalRecords.some(r=>r.face.geomType==='PLANE'&&r.normal.dot(record.normal)>.999999&&Math.abs(r.normal.dot(r.center.clone().sub(record.center))-distance)<1e-5);
      if(!exists)throw Error('指定の壁厚では内側の空間が塞がるか、別の壁と干渉します。壁厚を小さくしてください');
     }
     if(keptHoles.some(c=>!matchingCylinder(c)))throw Error('元の穴径を維持すると穴が外側や別の穴とつながります。倍率・穴径維持の設定を見直してください');
    }finally{finalFaces.forEach(f=>f.delete());}
    const beforeParts=solids(scaled),afterParts=solids(next);try{if(beforeParts.length!==afterParts.length)throw Error('壁厚や穴径の調整で部品がつながる・分離するため中止しました');}finally{beforeParts.forEach(p=>p.delete());afterParts.forEach(p=>p.delete());}
    analysis.wallFaces+=wallFaces.size;analysis.holeFaces+=holeCount;prepared.set(id,next);next=null;
   }finally{next?.delete();scaled.delete();faces.forEach(f=>f.delete());}
  }
  if(spec.keepHoles&&!analysis.holeFaces&&factor!==1)throw Error('穴径を維持できる単独の円筒穴がありません。円筒壁の内径は壁厚を優先します');
  // Preserve explicit gaps between axis-aligned, separated bodies by translating
  // complete bodies. This leaves their wall and hole constraints intact.
  if(spec.keepGap&&factor!==1){
   const positions=new Map([...prepared].map(([id])=>[id,[0,0,0]])),links=[];
   for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){
    const [a,sa]=selected[i],[b,sb]=selected[j],ba=bounds(sa),bb=bounds(sb);
    for(let axis=0;axis<3;axis++)for(const [left,right,lbox,rbox] of [[a,b,ba,bb],[b,a,bb,ba]])if(Math.abs(rbox[0][axis]-lbox[1][axis]-gap)<Math.max(1e-5,gap*.002)&&[0,1,2].filter(k=>k!==axis).every(k=>Math.min(lbox[1][k],rbox[1][k])-Math.max(lbox[0][k],rbox[0][k])>1e-5)&&Math.abs(R.measureDistanceBetween(sa,sb)-gap)<1e-5)links.push({left,right,axis,delta:gap*(1-factor)});
   }
   if(!links.length)throw Error('指定した元のすき間に一致する、軸方向に並んだ別ボディがありません。入り組んだはめ合いは個別に調整してください');
   for(const axis of [0,1,2]){const known=new Map();for(const [id] of selected){if(known.has(id))continue;known.set(id,0);const queue=[id];while(queue.length){const from=queue.shift();for(const l of links.filter(l=>l.axis===axis&&(l.left===from||l.right===from))){const to=l.left===from?l.right:l.left,value=known.get(from)+(l.left===from?l.delta:-l.delta);if(known.has(to)){if(Math.abs(known.get(to)-value)>1e-5)throw Error('複数のすき間の維持条件が競合しています。対象を分けてください');}else{known.set(to,value);queue.push(to);}}}}for(const [id,value] of known)positions.get(id)[axis]=value;}
   for(const [id,offset] of positions){const moved=prepared.get(id).translate(offset);prepared.set(id,moved);}analysis.gaps=links.length;
   if(links.some(l=>Math.abs(R.measureDistanceBetween(prepared.get(l.left),prepared.get(l.right))-gap)>1e-5))throw Error('面間のすき間を指定どおり維持できません。対象を分けて調整してください');
   for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++)if(R.measureDistanceBetween(selected[i][1],selected[j][1])>1e-5&&R.measureDistanceBetween(prepared.get(selected[i][0]),prepared.get(selected[j][0]))<1e-5)throw Error('すき間維持の移動で別のボディと接触するため中止しました。対象を分けてください');
  }
  for(const [id,shape] of prepared)analysis.bodies.push({id,bounds:bounds(shape),volume:volume(shape)});
  return {outputs:[...prepared].map(([id,shape])=>output(shape,id)),remove:[],analysis:{resize:analysis}};
 }finally{for(const shape of prepared.values())shape.delete();}
}

export function compareBodyShapes(before,after,onProgress){
 const a=[...before.values()],b=[...after.values()],result={before:[],after:[],added:[],removed:[],volumes:{added:0,removed:0}};
 let beforeAll,afterAll;
 try{
  if(a.length)beforeAll=R.makeCompound(a.map(s=>s.clone())).asShape3D();if(b.length)afterAll=R.makeCompound(b.map(s=>s.clone())).asShape3D();
  for(const [name,source,opposite] of [['after',after,beforeAll],['before',before,afterAll]])for(const [id,shape] of source){
   onProgress?.({stage:'加工前後の追加・削除部分を計算しています'});result[name].push({id,...shape.mesh({tolerance:.08,angularTolerance:.15})});
   const same=(name==='after'?before:after).get(id);if(same&&same.serialize()===shape.serialize())continue;
   const delta=opposite?shape.cut(opposite):shape.clone();try{const amount=volume(delta);if(amount>1e-7){if(!valid(delta))throw Error('差分の形状を検証できません。対象を分けて比較してください');const key=name==='after'?'added':'removed';result[key].push({id,...delta.mesh({tolerance:.08,angularTolerance:.15})});result.volumes[key]+=amount;}}finally{delta.delete();}
  }
  return result;
 }finally{beforeAll?.delete();afterAll?.delete();}
}
