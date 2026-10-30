import * as R from 'replicad';
import * as THREE from 'three';
import {svgCylinderInfo} from './svg-wrap.js';
import {honeycombSettings,honeycombLayout} from './honeycomb-layout.js';
const vec=p=>new THREE.Vector3(...p),tuple=p=>p.toArray();
const positive=n=>{const k=n.toArray().reduce((a,v,i)=>Math.abs(v)>Math.abs(n.getComponent(a))?i:a,0);return n.getComponent(k)<0?n.negate():n;};
export function honeycombBodyInfo(base,heightAxis='Z'){
 if(!base)throw Error('円柱または直方体を選択してください');
 const faces=base.faces;
 try{
  const curved=faces.filter(f=>f.geomType!=='PLANE');
  if(curved.length){
   if(curved.some(f=>f.geomType!=='CYLINDRE'))throw Error('円柱または直方体の側面に対応しています。フィレットなどは格子の後に追加してください');
   const candidates=curved.map(face=>{const s=face.surface,c=s.wrapped.Cylinder();try{return {face,radius:c.Radius()};}finally{c.delete();s.delete();}}).sort((a,b)=>b.radius-a.radius);
   const point=candidates[0].face.pointOnSurface(.37,.5);let info;
   try{info=svgCylinderInfo(base,point.toTuple());}finally{point.delete();}
   // Only complete coaxial cylinders (including an existing cylindrical cavity) are supported.
   for(const {face}of candidates){const s=face.surface,c=s.wrapped.Cylinder(),d=c.Axis().Direction(),o=c.Location();try{
    const axis=vec(info.axis),delta=new THREE.Vector3(o.X(),o.Y(),o.Z()).sub(vec(info.origin));
    if(Math.abs(axis.dot(new THREE.Vector3(d.X(),d.Y(),d.Z())))<.999999||delta.addScaledVector(axis,-delta.dot(axis)).length()>1e-5)throw Error('同じ軸の円柱を選択してください');
   }finally{d.delete();o.delete();c.delete();s.delete();}}
   const n=vec(info.axis),u=new THREE.Vector3(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0);u.addScaledVector(n,-u.dot(n)).normalize();
   return {kind:'cylinder',...info,u:tuple(u),v:tuple(n.clone().cross(u)),n:info.axis};
  }
  const axes=[];
  for(const face of faces){const normal=face.normalAt();let n;try{n=positive(vec(normal.toTuple()).normalize());}finally{normal.delete();}if(!axes.some(a=>Math.abs(a.dot(n))>.999999))axes.push(n);}
  if(axes.length!==3||axes.some((a,i)=>axes.slice(i+1).some(b=>Math.abs(a.dot(b))>1e-6)))throw Error('直交した側面を持つ直方体を選択してください');
  const hint=new THREE.Vector3(...({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[heightAxis]));
  const n=[...axes].sort((a,b)=>Math.abs(b.dot(hint))-Math.abs(a.dot(hint)))[0],u=axes.find(a=>a!==n),v=n.clone().cross(u).normalize();
  const edges=base.edges,points=[];try{for(const edge of edges){const a=edge.startPoint,b=edge.endPoint;try{points.push(vec(a.toTuple()),vec(b.toTuple()));}finally{a.delete();b.delete();}}}finally{edges.forEach(edge=>edge.delete());}
  const ranges=[u,v,n].map(a=>{const values=points.map(p=>p.dot(a));return [Math.min(...values),Math.max(...values)];});
  const origin=u.clone().multiplyScalar(ranges[0][0]).addScaledVector(v,ranges[1][0]).addScaledVector(n,ranges[2][0]);
  return {kind:'box',origin:tuple(origin),u:tuple(u),v:tuple(v),n:tuple(n),width:ranges[0][1]-ranges[0][0],depth:ranges[1][1]-ranges[1][0],height:ranges[2][1]-ranges[2][0]};
 }finally{faces.forEach(face=>face.delete());}
}
function prism(points,origin,u,n,depth){
 const plane=new R.Plane(origin,u,n);let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);
 let sketch;try{sketch=drawing.close().sketchOnPlane(plane);return sketch.extrude(depth);}finally{sketch?.delete();plane.delete();}
}
function cutBatch(base,tools){
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Cut(),args=new oc.NCollection_List_TopoDS_Shape(),cuts=new oc.NCollection_List_TopoDS_Shape();
 try{args.Append(base.wrapped);tools.forEach(tool=>cuts.Append(tool.wrapped));builder.SetArguments(args);builder.SetTools(cuts);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();if(builder.HasErrors())throw Error('穴の切り取りに失敗しました。穴の数や幅を調整してください');return R.cast(builder.Shape()).asShape3D();}
 finally{builder.delete();args.delete();cuts.delete();}
}
export function makeHoneycomb(base,input,onProgress){
 const p=honeycombSettings(input),info=honeycombBodyInfo(base,p.heightAxis),tools=[],n=vec(info.n),u=vec(info.u),v=vec(info.v),origin=vec(info.origin),t=p.thickness;
 const world=(x,y,z)=>origin.clone().addScaledVector(u,x).addScaledVector(v,y).addScaledVector(n,z).toArray();
 let shape,cavity,hollow;let holeCount=0;
 try{
  const inputParts=base.solids;try{if(inputParts.length!==1)throw Error('1つにつながったソリッドを選択してください');}finally{inputParts.forEach(s=>s.delete());}
  if(info.height<=2*t+.1||(info.kind==='cylinder'?info.radius<=t+.1:Math.min(info.width,info.depth)<=2*t+.1))throw Error('側壁の厚みが大きすぎます。内側に空間が残る値にしてください');
  if(p.hollow){
   if(info.kind==='cylinder')cavity=R.makeCylinder(info.radius-t,info.height-2*t,world(0,0,t),info.n);
   else cavity=prism([[t,t],[info.width-t,t],[info.width-t,info.depth-t],[t,info.depth-t]],world(0,0,t),info.u,info.n,info.height-2*t);
   hollow=base.cut(cavity);
  }
  if(info.kind==='cylinder'){
   if(p.scope==='selected')throw Error('円柱は側面を一周加工します。加工範囲を「全側面」にしてください');
   const inner=info.radius-t;
   if(p.cell+p.rib>=inner*1.4)throw Error('円柱に対して六角穴が大きすぎます。穴や格子の幅を小さくしてください');
   // Lay out at the inner radius, where the webs are narrowest. The chord
   // correction prevents neighbouring holes touching on the inside of the wall.
   const minAngle=2*Math.asin((p.cell+p.rib)/(2*inner)),columns=Math.floor(2*Math.PI/minAngle);
   const layout=honeycombLayout(columns*(p.cell+p.rib),info.height,p,true);
   for(const [x,z]of layout.centers){
    const angle=x/layout.pitch*2*Math.PI/columns,radial=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle)),tangent=n.clone().cross(radial);
    const at=origin.clone().addScaledVector(n,z).addScaledVector(radial,info.radius+.02);
    tools.push(prism(layout.hex,tuple(at),tuple(tangent),tuple(radial.clone().negate()),t+.04+(p.cell/2)**2/inner));holeCount++;
   }
  }else{
   const sides=[{at:[0,0,0],u:info.u,n:tuple(v.clone().negate()),width:info.width},{at:[info.width,info.depth,0],u:tuple(u.clone().negate()),n:info.v,width:info.width},{at:[0,info.depth,0],u:tuple(v.clone().negate()),n:tuple(u.clone().negate()),width:info.depth},{at:[info.width,0,0],u:info.v,n:info.u,width:info.depth}];
   const selected=p.scope==='selected';
   if(selected&&(!Array.isArray(p.faceNormal)||p.faceNormal.length!==3||!p.faceNormal.every(Number.isFinite)||vec(p.faceNormal).length()<.9))throw Error('加工したい箱の側面を先にクリックしてください');
   const matches=sides.filter(side=>!selected||vec(side.n).dot(vec(p.faceNormal).normalize())>.999);
   if(!matches.length)throw Error('上面・底面ではなく箱の側面を選択してください');
   for(const side of matches){
    const layout=honeycombLayout(side.width,info.height,p),su=vec(side.u),outward=vec(side.n),start=vec(world(...side.at));
    if(holeCount+layout.centers.length>240)throw Error('六角穴は合計240個までです。穴の幅や格子の幅を大きくしてください');
    for(const [x,z]of layout.centers){const at=start.clone().addScaledVector(su,x).addScaledVector(n,z).addScaledVector(outward,.02);tools.push(prism(layout.hex,tuple(at),side.u,tuple(outward.clone().negate()),t+.04));holeCount++;}
   }
  }
  if(!holeCount)throw Error('この大きさでは六角穴を配置できません。穴の幅か端の枠幅を小さくしてください');
  if(holeCount>240)throw Error('六角穴は合計240個までです。穴の幅や格子の幅を大きくしてください');
  onProgress?.({stage:holeCount+'個の六角穴をまとめて加工しています'});
  shape=cutBatch(hollow||base,tools);
  const oc=R.getOC(),check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false),parts=shape.solids;
  try{if(!check.IsValid()||parts.length!==1||R.measureVolume(shape)<=0||R.measureVolume(hollow||base)-R.measureVolume(shape)<1e-6)throw Error('格子を一体のソリッドにできません。格子・端の枠の幅を増やしてください');}finally{check.delete();parts.forEach(s=>s.delete());}
  const result=shape;shape=null;return {shape:result,info:{kind:info.kind,holeCount,thickness:t,cell:p.cell,rib:p.rib,border:Math.max(p.border,t)}};
 }finally{shape?.delete();hollow?.delete();cavity?.delete();tools.forEach(tool=>tool.delete());}
}
